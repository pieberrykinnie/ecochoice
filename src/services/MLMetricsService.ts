import { MLService } from './MLService';

export interface MLMetrics {
  modelVersion: string;
  lastTrainingDate: number;
  totalPredictions: number;
  accuracyScore: number;
  confidenceThreshold: number;
  dataPoints: number;
  trainingHistory: Array<{
    timestamp: number;
    accuracy: number;
    loss: number;
  }>;
}

export class MLMetricsService {
  private static instance: MLMetricsService;
  private mlService: MLService;
  private metrics: MLMetrics;
  private readonly METRICS_KEY = 'mlMetrics';
  private readonly UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.mlService = MLService.getInstance();
    this.metrics = {
      modelVersion: '1.0.0',
      lastTrainingDate: Date.now(),
      totalPredictions: 0,
      accuracyScore: 0.85,
      confidenceThreshold: 0.7,
      dataPoints: 0,
      trainingHistory: []
    };
  }

  public static getInstance(): MLMetricsService {
    if (!MLMetricsService.instance) {
      MLMetricsService.instance = new MLMetricsService();
    }
    return MLMetricsService.instance;
  }

  public async initialize(): Promise<void> {
    await this.loadMetrics();
    this.startPeriodicUpdate();
  }

  public async updateMetrics(predictionResult: number, actualScore?: number): Promise<void> {
    this.metrics.totalPredictions++;
    
    if (actualScore !== undefined) {
      const error = Math.abs(predictionResult - actualScore);
      const newAccuracy = 1 - error;
      this.metrics.accuracyScore = (
        this.metrics.accuracyScore * (this.metrics.totalPredictions - 1) + newAccuracy
      ) / this.metrics.totalPredictions;
    }

    await this.saveMetrics();
  }

  public async recordTraining(accuracy: number, loss: number): Promise<void> {
    this.metrics.trainingHistory.push({
      timestamp: Date.now(),
      accuracy,
      loss
    });

    // Keep only last 100 training records
    if (this.metrics.trainingHistory.length > 100) {
      this.metrics.trainingHistory = this.metrics.trainingHistory.slice(-100);
    }

    this.metrics.lastTrainingDate = Date.now();
    await this.saveMetrics();
  }

  public async getMetrics(): Promise<MLMetrics> {
    return { ...this.metrics };
  }

  private async loadMetrics(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(this.METRICS_KEY);
      if (data[this.METRICS_KEY]) {
        this.metrics = data[this.METRICS_KEY];
      }
    } catch (error) {
      console.error('Failed to load ML metrics:', error);
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      await chrome.storage.local.set({ [this.METRICS_KEY]: this.metrics });
    } catch (error) {
      console.error('Failed to save ML metrics:', error);
    }
  }

  private startPeriodicUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      const modelMetrics = await this.mlService.getModelMetrics();
      this.metrics.dataPoints = modelMetrics.dataPoints;
      await this.saveMetrics();
    }, this.UPDATE_INTERVAL);
  }

  public stopPeriodicUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
} 