import * as tf from '@tensorflow/tfjs';
import {
  MLFeatures,
  ProductFeatures,
  createModel,
  extractFeatures,
  loadModel,
  saveModel,
  trainModel,
  predictScore
} from '../utils/ml';
import { CacheService } from './CacheService';

export class MLService {
  private static instance: MLService;
  private model: tf.LayersModel | null = null;
  private isTraining = false;
  private trainingData: Array<{
    features: ProductFeatures;
    score: number;
  }> = [];
  private cacheService: CacheService;
  private readonly PREDICTION_TIMEOUT = 5000; // 5 seconds
  private readonly MAX_RETRIES = 3;

  private constructor() {
    this.cacheService = CacheService.getInstance();
  }

  static getInstance(): MLService {
    if (!MLService.instance) {
      MLService.instance = new MLService();
    }
    return MLService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Try to load existing model
      this.model = await loadModel();
      
      // Load training data from storage
      const data = await chrome.storage.local.get('mlTrainingData');
      if (data.mlTrainingData) {
        this.trainingData = data.mlTrainingData;
      }

      // If no model exists, create a new one
      if (!this.model) {
        this.model = await createModel();
        await this.trainModel(); // Initial training with any existing data
      }
    } catch (error) {
      await this.cacheService.logError(error as Error, { context: 'initialize' });
      throw error;
    }
  }

  async addTrainingData(features: ProductFeatures, score: number): Promise<void> {
    try {
      this.trainingData.push({ features, score });
      
      // Keep only last 1000 entries
      if (this.trainingData.length > 1000) {
        this.trainingData = this.trainingData.slice(-1000);
      }

      // Save to storage
      await chrome.storage.local.set({
        mlTrainingData: this.trainingData
      });

      // Update last training timestamp
      await chrome.storage.local.set({
        lastTraining: Date.now()
      });

      // Retrain if we have enough new data
      if (this.trainingData.length % 10 === 0) { // Train every 10 new samples
        await this.trainModel();
      }
    } catch (error) {
      await this.cacheService.logError(error as Error, {
        context: 'addTrainingData',
        features,
        score
      });
    }
  }

  async trainModel(): Promise<void> {
    if (!this.model || this.isTraining || this.trainingData.length < 10) {
      return;
    }

    this.isTraining = true;
    try {
      // Prepare training data
      const features = this.trainingData.map(d => extractFeatures(d.features));
      const labels = this.trainingData.map(d => d.score);

      // Train the model
      const history = await trainModel(this.model, features, labels);

      // Save the updated model
      await saveModel(this.model);

      // Update training history
      const data = await chrome.storage.local.get('trainingHistory');
      const trainingHistory = data.trainingHistory || [];
      trainingHistory.push({
        timestamp: new Date().toISOString(),
        accuracy: history.history.acc[history.history.acc.length - 1],
        loss: history.history.loss[history.history.loss.length - 1]
      });
      await chrome.storage.local.set({ trainingHistory });

      console.log('Model training completed successfully');
    } catch (error) {
      await this.cacheService.logError(error as Error, { context: 'trainModel' });
      throw error;
    } finally {
      this.isTraining = false;
    }
  }

  async predict(features: ProductFeatures): Promise<number> {
    // Try to get from cache first
    const cached = await this.cacheService.getCachedPrediction(features);
    if (cached) {
      return cached.score;
    }

    // If not in cache, make prediction with retry logic
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const predictionPromise = this.makePrediction(features);
        const score = await Promise.race([
          predictionPromise,
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Prediction timeout')), this.PREDICTION_TIMEOUT);
          })
        ]);

        // Cache successful prediction
        await this.cacheService.cachePrediction(features, {
          score,
          confidence: 'high',
          timestamp: Date.now()
        });

        return score;
      } catch (error) {
        if (attempt === this.MAX_RETRIES) {
          await this.cacheService.logError(error as Error, {
            context: 'predict',
            features,
            attempt
          });
          throw error;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }

    throw new Error('Failed to make prediction after retries');
  }

  private async makePrediction(features: ProductFeatures): Promise<number> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const mlFeatures = extractFeatures(features);
    return await predictScore(this.model, mlFeatures);
  }

  async getModelMetrics(): Promise<{
    dataPoints: number;
    lastTraining: string;
    accuracy: number;
  }> {
    try {
      const [modelAccuracy, lastTraining] = await Promise.all([
        chrome.storage.local.get('modelAccuracy'),
        chrome.storage.local.get('lastTraining')
      ]);

      return {
        dataPoints: this.trainingData.length,
        lastTraining: lastTraining.lastTraining || 'Never',
        accuracy: modelAccuracy.modelAccuracy || 0
      };
    } catch (error) {
      await this.cacheService.logError(error as Error, { context: 'getModelMetrics' });
      throw error;
    }
  }
} 