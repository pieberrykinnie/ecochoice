import { CacheService } from '../CacheService';
import { ProductFeatures } from '../../utils/ml';

// Mock storage implementation
const mockStorage = {
  predictionCache: {},
  errorLogs: [],
  cacheStats: {
    cacheSize: 0,
    hitRate: 0,
    errorRate: 0
  }
};

// Mock chrome.storage before tests
beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn().mockImplementation(() => Promise.resolve(mockStorage)),
        set: jest.fn().mockImplementation((data) => {
          Object.assign(mockStorage, data);
          return Promise.resolve();
        })
      }
    }
  } as any;
});

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

  beforeEach(async () => {
    jest.useFakeTimers();
    // Reset the singleton instance and storage
    (CacheService as any).instance = null;
    Object.assign(mockStorage, {
      predictionCache: {},
      errorLogs: [],
      cacheStats: {
        cacheSize: 0,
        hitRate: 0,
        errorRate: 0
      }
    });
    
    // Initialize service
    cacheService = await CacheService.getInstance();
  });

  afterEach(async () => {
    // Stop cleanup interval and clear timers
    if (cacheService) {
      await cacheService.stopCleanup();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    jest.restoreAllMocks();
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
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          predictionCache: expect.any(Object)
        })
      );
    });

    it('should return null for expired cache entries', async () => {
      const mockPrediction = {
        score: 0.85,
        confidence: 'high',
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours old
      };

      await cacheService.cachePrediction(mockFeatures, mockPrediction);
      
      // Advance time by 25 hours
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);

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
        context,
        timestamp: expect.any(Number)
      }));
    });

    it('should maintain maximum error log size', async () => {
      const errors = Array.from({ length: 150 }, (_, i) => 
        new Error(`Error ${i}`)
      );

      for (const error of errors) {
        await cacheService.logError(error, { context: 'test' });
      }

      const logs = await cacheService.getErrorLogs();
      expect(logs.length).toBeLessThanOrEqual(100);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          errorLogs: expect.any(Array)
        })
      );
    });

    it('should clean up old error logs', async () => {
      const oldError = new Error('Old error');
      const newError = new Error('New error');

      // Add old error (8 days ago)
      await cacheService.logError(oldError, { context: 'old' });
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000);
      (cacheService as any).errorLogs[0].timestamp = oldTimestamp;

      // Add new error
      await cacheService.logError(newError, { context: 'new' });

      // Run cleanup
      await cacheService.cleanupExpiredEntries();

      const logs = await cacheService.getErrorLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].error).toBe(newError.message);
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
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          predictionCache: expect.any(Object)
        })
      );
    });

    it('should load cache from storage on initialization', async () => {
      const mockKey = JSON.stringify({
        title: mockFeatures.title,
        type: mockFeatures.productType,
        price: mockFeatures.price
      });

      const mockStorage = {
        predictionCache: {
          [mockKey]: {
            score: 0.85,
            confidence: 'high',
            timestamp: Date.now()
          }
        },
        errorLogs: []
      };

      // Mock storage.get to return our mock data
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => 
        Promise.resolve(mockStorage)
      );

      // Get new instance to trigger loading from storage
      (CacheService as any).instance = null;
      cacheService = await CacheService.getInstance();
      
      // Wait for async initialization
      await cacheService.getCachedPrediction(mockFeatures);
      
      const stats = await cacheService.getStats();
      expect(stats.cacheSize).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      const mockPrediction = {
        score: 0.85,
        confidence: 'high',
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours old
      };

      await cacheService.cachePrediction(mockFeatures, mockPrediction);
      
      // Advance time by 25 hours
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);
      await cacheService.cleanupExpiredEntries();

      const stats = await cacheService.getStats();
      expect(stats.cacheSize).toBe(0);
    });

    it('should stop cleanup interval when requested', async () => {
      const mockSetInterval = jest.spyOn(global, 'setInterval');
      const mockClearInterval = jest.spyOn(global, 'clearInterval');
      
      // Reset instance to trigger new interval creation
      (CacheService as any).instance = null;
      cacheService = await CacheService.getInstance();
      
      expect(mockSetInterval).toHaveBeenCalled();
      
      await cacheService.stopCleanup();
      expect(mockClearInterval).toHaveBeenCalled();
      expect((cacheService as any).cleanupInterval).toBeNull();
    });

    it('should run cleanup periodically', async () => {
      const cleanupSpy = jest.spyOn(cacheService as any, 'cleanupExpiredEntries');
      
      // Advance time by 2 hours
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      
      expect(cleanupSpy).toHaveBeenCalledTimes(2);
    });
  });
}); 