import { ProductFeatures } from '../utils/ml';

interface CachedPrediction {
  score: number;
  confidence: string;
  timestamp: number;
}

interface ErrorLog {
  error: string;
  timestamp: number;
  context: any;
}

export class CacheService {
  private static instance: CacheService;
  private cache: Map<string, CachedPrediction>;
  private errorLogs: ErrorLog[];
  private cleanupInterval: NodeJS.Timeout | null;
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_ERROR_LOGS = 100;
  private initialized: boolean = false;

  private constructor() {
    this.cache = new Map();
    this.errorLogs = [];
    this.cleanupInterval = null;
  }

  public static async getInstance(): Promise<CacheService> {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
      await CacheService.instance.initialize();
    }
    return CacheService.instance;
  }

  private async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.loadFromStorage();
      this.setupPeriodicCleanup();
      this.initialized = true;
    }
  }

  private setupPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    // Clean up expired cache entries every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 60 * 1000);
  }

  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(['predictionCache', 'errorLogs']);
      
      if (data.predictionCache) {
        this.cache = new Map(Object.entries(data.predictionCache));
      }
      
      if (data.errorLogs) {
        this.errorLogs = data.errorLogs;
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
      // Initialize with empty state on error
      this.cache = new Map();
      this.errorLogs = [];
    }
  }

  private async saveToStorage(): Promise<void> {
    await chrome.storage.local.set({
      predictionCache: Object.fromEntries(this.cache),
      errorLogs: this.errorLogs
    });
  }

  public async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();
    const expiredKeys = Array.from(this.cache.entries())
      .filter(([_, { timestamp }]) => now - timestamp > 24 * 60 * 60 * 1000)
      .map(([key]) => key);

    expiredKeys.forEach(key => this.cache.delete(key));

    // Also clean up old error logs
    this.errorLogs = this.errorLogs.filter(
      log => now - log.timestamp <= 7 * 24 * 60 * 60 * 1000
    );

    await this.saveToStorage();
  }

  private generateCacheKey(features: ProductFeatures): string {
    // Create a unique key based on product features
    return JSON.stringify({
      title: features.title,
      type: features.productType,
      price: features.price
    });
  }

  async getCachedPrediction(features: ProductFeatures): Promise<CachedPrediction | null> {
    const key = this.generateCacheKey(features);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp <= this.CACHE_EXPIRY) {
      return cached;
    }
    
    return null;
  }

  async cachePrediction(
    features: ProductFeatures,
    prediction: CachedPrediction
  ): Promise<void> {
    const key = this.generateCacheKey(features);
    
    // Implement LRU-like eviction if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, prediction);
    await this.saveToStorage();
  }

  async logError(error: Error, context: any = {}): Promise<void> {
    this.errorLogs.unshift({
      error: error.message,
      timestamp: Date.now(),
      context
    });
    
    // Keep only the most recent errors
    if (this.errorLogs.length > this.MAX_ERROR_LOGS) {
      this.errorLogs = this.errorLogs.slice(0, this.MAX_ERROR_LOGS);
    }
    
    await this.saveToStorage();
  }

  async getErrorLogs(): Promise<ErrorLog[]> {
    return this.errorLogs;
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    await this.saveToStorage();
  }

  async getStats(): Promise<{
    cacheSize: number;
    hitRate: number;
    errorRate: number;
  }> {
    const data = await chrome.storage.local.get('cacheStats');
    return data.cacheStats || {
      cacheSize: this.cache.size,
      hitRate: 0,
      errorRate: 0
    };
  }
} 