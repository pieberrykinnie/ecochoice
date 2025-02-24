import { CacheService } from '../CacheService';
import { ProductFeatures } from '../../utils/ml';

describe('CacheService', () => {
  let cacheService: CacheService;
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

  beforeEach(() => {
    // Clear storage mock
    jest.clearAllMocks();
    // Reset instance
    (CacheService as any).instance = null;
    // Get fresh instance
    cacheService = CacheService.getInstance();
  });

  describe('caching', () => {
    it('should store and retrieve predictions', async () => {
      const mockPrediction = {
        score: 0.85,
        confidence: 'high',
        timestamp: Date.now()
      };

      await cacheService.cachePrediction(mockFeatures, mockPrediction);
      const cached = await cacheService.getCachedPrediction(mockFeatures);
      
      expect(cached).toEqual(mockPrediction);
    });

    it('should return null for expired cache entries', async () => {
      const mockPrediction = {
        score: 0.85,
        confidence: 'high',
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours old
      };

      await cacheService.cachePrediction(mockFeatures, mockPrediction);
      const cached = await cacheService.getCachedPrediction(mockFeatures);
      
      expect(cached).toBeNull();
    });

    it('should maintain maximum cache size', async () => {
      const predictions = Array.from({ length: 1100 }, (_, i) => ({
        score: 0.85,
        confidence: 'high',
        timestamp: Date.now() + i
      }));

      for (const prediction of predictions) {
        await cacheService.cachePrediction(mockFeatures, prediction);
      }

      const stats = await cacheService.getStats();
      expect(stats.cacheSize).toBeLessThanOrEqual(1000);
    });
  });

  describe('error logging', () => {
    it('should store and retrieve error logs', async () => {
      const error = new Error('Test error');
      const context = { test: true };

      await cacheService.logError(error, context);
      const logs = await cacheService.getErrorLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(expect.objectContaining({
        error: error.message,
        context
      }));
    });

    it('should maintain maximum error log size', async () => {
      const errors = Array.from({ length: 150 }, (_, i) => 
        new Error(`Error ${i}`)
      );

      for (const error of errors) {
        await cacheService.logError(error);
      }

      const logs = await cacheService.getErrorLogs();
      expect(logs).toHaveLength(100);
      expect(logs[0].error).toBe('Error 149'); // Most recent error
    });
  });

  describe('storage integration', () => {
    it('should persist cache to storage', async () => {
      const mockPrediction = {
        score: 0.85,
        confidence: 'high',
        timestamp: Date.now()
      };

      await cacheService.cachePrediction(mockFeatures, mockPrediction);
      
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          predictionCache: expect.any(Object)
        })
      );
    });

    it('should load cache from storage on initialization', async () => {
      const mockStorage = {
        predictionCache: {
          'test-key': {
            score: 0.85,
            confidence: 'high',
            timestamp: Date.now()
          }
        }
      };

      global.chrome.storage.local.get.mockImplementation(() => 
        Promise.resolve(mockStorage)
      );

      // Get new instance to trigger loading from storage
      (CacheService as any).instance = null;
      cacheService = CacheService.getInstance();
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const stats = await cacheService.getStats();
      expect(stats.cacheSize).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      jest.useFakeTimers();

      const mockPrediction = {
        score: 0.85,
        confidence: 'high',
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours old
      };

      await cacheService.cachePrediction(mockFeatures, mockPrediction);
      
      // Fast forward 1 hour
      jest.advanceTimersByTime(60 * 60 * 1000);
      
      const stats = await cacheService.getStats();
      expect(stats.cacheSize).toBe(0);

      jest.useRealTimers();
    });
  });
}); 