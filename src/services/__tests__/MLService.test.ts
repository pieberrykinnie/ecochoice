// Mock TensorFlow.js and CacheService before any other code
jest.mock('@tensorflow/tfjs', () => {
  const mockFit = jest.fn().mockResolvedValue({
    history: {
      loss: [0.1],
      acc: [0.9]
    }
  });

  const mockTensor = {
    dataSync: jest.fn().mockReturnValue([0.85]),
    data: jest.fn().mockResolvedValue([0.85]),
    dispose: jest.fn(),
    reshape: jest.fn().mockReturnThis(),
    div: jest.fn().mockReturnThis()
  };

  const mockModel = {
    predict: jest.fn().mockReturnValue(mockTensor),
    fit: mockFit,
    save: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    compile: jest.fn(),
    add: jest.fn()
  };

  return {
    sequential: jest.fn().mockReturnValue(mockModel),
    layers: {
      dense: jest.fn().mockReturnValue({ apply: jest.fn() }),
      dropout: jest.fn().mockReturnValue({ apply: jest.fn() })
    },
    tensor2d: jest.fn().mockReturnValue(mockTensor),
    concat: jest.fn().mockReturnValue(mockTensor),
    train: {
      adam: jest.fn().mockReturnValue({})
    },
    loadLayersModel: jest.fn().mockResolvedValue(mockModel)
  };
});

// Create a mock CacheService instance with all required methods
const createMockCacheService = () => ({
  getCachedPrediction: jest.fn().mockResolvedValue(null),
  cachePrediction: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined),
  getErrorLogs: jest.fn().mockResolvedValue([]),
  clearCache: jest.fn().mockResolvedValue(undefined),
  getStats: jest.fn().mockResolvedValue({
    cacheSize: 0,
    hitRate: 0,
    errorRate: 0
  }),
  stopCleanup: jest.fn().mockResolvedValue(undefined)
});

// Mock CacheService
const mockCacheService = createMockCacheService();
jest.mock('../CacheService', () => ({
  CacheService: {
    getInstance: jest.fn().mockResolvedValue(mockCacheService)
  }
}));

import * as tf from '@tensorflow/tfjs';
import { MLService } from '../MLService';
import { CacheService } from '../CacheService';
import { ProductFeatures } from '../../utils/ml';

describe('MLService', () => {
  let mlService: MLService;

  const mockFeatures: ProductFeatures = {
    title: 'Test Product',
    description: 'A test product',
    productType: 'electronic',
    price: 99.99,
    materials: ['plastic', 'metal'],
    certifications: ['energy_star'],
    weight: 1.5,
    energyConsumption: 100
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Reset MLService instance
    (MLService as any).instance = null;
    
    // Initialize MLService
    mlService = MLService.getInstance();
    await mlService.initialize();
    
    // Ensure cacheService is set
    (mlService as any).cacheService = mockCacheService;
  });

  afterEach(async () => {
    // Clean up any timers
    jest.clearAllTimers();
    jest.useRealTimers();

    // Stop any cleanup intervals
    if (mockCacheService.stopCleanup) {
      await mockCacheService.stopCleanup();
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should update training data and retrain model', async () => {
    // Add enough training data to trigger training (minimum 10 items)
    for (let i = 0; i < 10; i++) {
      await mlService.addTrainingData(mockFeatures, 0.85);
    }
    
    // Get the model instance from MLService
    const model = (mlService as any).model;
    expect(model.fit).toHaveBeenCalled();
  });

  describe('initialization', () => {
    it('should create a new model if none exists', async () => {
      // Reset instance to force new model creation
      (MLService as any).instance = null;
      (tf.loadLayersModel as jest.Mock).mockRejectedValueOnce(new Error('No model found'));
      
      // Get new MLService instance
      mlService = MLService.getInstance();
      
      // Inject mock cache service before initialization
      (mlService as any).cacheService = mockCacheService;
      
      await mlService.initialize();

      expect(mlService['model']).toBeDefined();
      expect(tf.sequential).toHaveBeenCalled();
    });

    it('should load training data from storage', async () => {
      const mockTrainingData = [{
        features: mockFeatures,
        score: 0.85
      }];

      (chrome.storage.local.get as jest.Mock)
        .mockResolvedValueOnce({ mlTrainingData: mockTrainingData });

      // Reset instance to force reinitialization
      (MLService as any).instance = null;
      mlService = MLService.getInstance();
      await mlService.initialize();

      expect(mlService['trainingData']).toEqual(mockTrainingData);
    });
  });

  describe('prediction', () => {
    it('should return cached prediction if available', async () => {
      const mockPrediction = {
        score: 0.85,
        confidence: 'high',
        timestamp: Date.now()
      };

      mockCacheService.getCachedPrediction.mockResolvedValueOnce(mockPrediction);

      const result = await mlService.predict(mockFeatures);
      expect(result).toBe(mockPrediction.score);
    });

    it('should make new prediction if no cache available', async () => {
      mockCacheService.getCachedPrediction.mockResolvedValueOnce(null);

      const result = await mlService.predict(mockFeatures);
      expect(result).toBeDefined();
      expect(mockCacheService.cachePrediction).toHaveBeenCalledWith(
        mockFeatures,
        expect.objectContaining({
          score: expect.any(Number),
          confidence: expect.any(String),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should retry failed predictions', async () => {
      const mockError = new Error('Prediction failed');
      
      // Mock first two attempts to fail, third to succeed
      (mlService as any).makePrediction = jest.fn()
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(0.85);

      // Set a shorter retry delay for testing
      (mlService as any).retryDelay = 100;

      // Start prediction
      const resultPromise = mlService.predict(mockFeatures);
      
      // Advance all pending timers
      await jest.runAllTimersAsync();
      
      // Get the final result
      const result = await resultPromise;
      
      expect(result).toBe(0.85);
      expect(mlService['makePrediction']).toHaveBeenCalledTimes(3);
    }, 15000);
  });

  describe('training', () => {
    it('should maintain maximum training data size', async () => {
      // Add more than the maximum allowed training data
      for (let i = 0; i < 1100; i++) {
        await mlService.addTrainingData(mockFeatures, 0.85);
      }

      expect(mlService['trainingData'].length).toBeLessThanOrEqual(1000);
    });
  });

  describe('metrics', () => {
    it('should return correct model metrics', async () => {
      const mockMetrics = {
        dataPoints: 100,
        lastTraining: new Date().toISOString(),
        accuracy: 0.85
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation(() => 
        Promise.resolve({
          modelAccuracy: mockMetrics.accuracy,
          lastTraining: mockMetrics.lastTraining
        })
      );

      mlService['trainingData'] = Array(mockMetrics.dataPoints).fill({
        features: mockFeatures,
        score: 0.85
      });

      const metrics = await mlService.getModelMetrics();
      expect(metrics).toEqual(mockMetrics);
    });
  });
}); 