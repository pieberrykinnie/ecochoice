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

export class MLService {
  private static instance: MLService;
  private model: tf.LayersModel | null = null;
  private isTraining = false;
  private trainingData: Array<{
    features: ProductFeatures;
    score: number;
  }> = [];

  private constructor() {}

  static getInstance(): MLService {
    if (!MLService.instance) {
      MLService.instance = new MLService();
    }
    return MLService.instance;
  }

  async initialize(): Promise<void> {
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
  }

  async addTrainingData(features: ProductFeatures, score: number): Promise<void> {
    this.trainingData.push({ features, score });
    
    // Keep only last 1000 entries
    if (this.trainingData.length > 1000) {
      this.trainingData = this.trainingData.slice(-1000);
    }

    // Save to storage
    await chrome.storage.local.set({
      mlTrainingData: this.trainingData
    });

    // Retrain if we have enough new data
    if (this.trainingData.length % 10 === 0) { // Train every 10 new samples
      await this.trainModel();
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
      await trainModel(this.model, features, labels);

      // Save the updated model
      await saveModel(this.model);

      console.log('Model training completed successfully');
    } catch (error) {
      console.error('Error training model:', error);
    } finally {
      this.isTraining = false;
    }
  }

  async predict(features: ProductFeatures): Promise<number> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    // Extract features
    const mlFeatures = extractFeatures(features);

    // Get prediction
    const score = await predictScore(this.model, mlFeatures);

    return score;
  }

  async getModelMetrics(): Promise<{
    dataPoints: number;
    lastTraining: string;
    accuracy: number;
  }> {
    return {
      dataPoints: this.trainingData.length,
      lastTraining: await chrome.storage.local.get('lastTraining')
        .then(data => data.lastTraining || 'Never'),
      accuracy: await chrome.storage.local.get('modelAccuracy')
        .then(data => data.modelAccuracy || 0)
    };
  }
} 