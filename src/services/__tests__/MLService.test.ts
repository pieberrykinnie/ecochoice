import * as tf from '@tensorflow/tfjs-node';
import { MLService } from '../MLService';
import { CacheService } from '../CacheService';
import { ProductFeatures } from '../../utils/ml';

// Mock Chrome API
declare global {
  namespace NodeJS {
    interface Global {
      chrome: {
        storage: {
          local: {
            get: jest.Mock;
            set: jest.Mock;
          };
        };
      };
    }
  }
}

// Setup Chrome storage mock
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
} as any;

// Mock CacheService
jest.mock('../CacheService', () => ({
  CacheService: {
    getInstance: jest.fn().mockReturnValue({
      getCachedPrediction: jest.fn(),
      cachePrediction: jest.fn(),
      logError: jest.fn()
    })
  }
}));

describe('MLService', () => {
  let mlService: MLService;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    // Get MLService instance
    mlService = MLService.getInstance();
  });

  describe('initialization', () => {
    it('should create a new model if none exists', async () => {
      const model = await mlService.initialize();
      expect(model).toBeDefined();
    });

    it('should load training data from storage', async () => {
      const mockData = {
        mlTrainingData: [
          {
            features: {
              title: 'Test Product',
              description: 'A test product',
              productType: 'electronic',
              price: 99.99,
              materials: ['plastic', 'metal'],
              certifications: ['energy_star'],
              weight: 1.5,
              energyConsumption: 100
            },
            score: 0.8
          }
        ]
      };

      // Mock chrome.storage.local.get
      global.chrome.storage.local.get.mockImplementation((key: string) => 
        Promise.resolve(mockData)
      );

      await mlService.initialize();
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith('mlTrainingData');
    });
  });

  describe('prediction', () => {
    const mockFeatures: ProductFeatures = {
      title: 'Eco-friendly Water Bottle',
      description: 'Sustainable and reusable',
      productType: 'household',
      price: 19.99,
      materials: ['stainless steel'],
      certifications: ['eco_friendly'],
      weight: 0.5,
      energyConsumption: 0
    };

    it('should return cached prediction if available', async () => {
      const mockCachedPrediction = {
        score: 0.85,
        confidence: 'high',
        timestamp: Date.now()
      };

      (CacheService.getInstance() as jest.Mocked<CacheService>)
        .getCachedPrediction.mockResolvedValue(mockCachedPrediction);

      const result = await mlService.predict(mockFeatures);
      expect(result).toBe(mockCachedPrediction.score);
    });

    it('should make new prediction if no cache available', async () => {
      (CacheService.getInstance() as jest.Mocked<CacheService>)
        .getCachedPrediction.mockResolvedValue(null);

      const result = await mlService.predict(mockFeatures);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should retry failed predictions', async () => {
      (CacheService.getInstance() as jest.Mocked<CacheService>)
        .getCachedPrediction.mockResolvedValue(null);

      // Mock first attempt to fail
      const mockPredict = jest.spyOn(mlService as any, 'makePrediction')
        .mockRejectedValueOnce(new Error('Prediction failed'))
        .mockResolvedValueOnce(0.75);

      const result = await mlService.predict(mockFeatures);
      expect(mockPredict).toHaveBeenCalledTimes(2);
      expect(result).toBe(0.75);
    });
  });

  describe('training', () => {
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

    it('should update training data and retrain model', async () => {
      // Add training data
      await mlService.addTrainingData(mockFeatures, 0.8);

      // Mock storage calls
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          mlTrainingData: expect.any(Array)
        })
      );
    });

    it('should maintain maximum training data size', async () => {
      // Add more than 1000 training samples
      for (let i = 0; i < 1010; i++) {
        await mlService.addTrainingData(mockFeatures, 0.8);
      }

      const metrics = await mlService.getModelMetrics();
      expect(metrics.dataPoints).toBeLessThanOrEqual(1000);
    });
  });

  describe('metrics', () => {
    it('should return correct model metrics', async () => {
      const mockMetrics = {
        modelAccuracy: 0.85,
        lastTraining: Date.now()
      };

      global.chrome.storage.local.get.mockImplementation(() => 
        Promise.resolve(mockMetrics)
      );

      const metrics = await mlService.getModelMetrics();
      expect(metrics).toEqual(expect.objectContaining({
        accuracy: expect.any(Number),
        lastTraining: expect.any(String),
        dataPoints: expect.any(Number)
      }));
    });
  });
}); 