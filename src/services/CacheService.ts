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
  private cache: Map<string, CachedPrediction> = new Map();
  private errorLogs: ErrorLog[] = [];
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_ERROR_LOGS = 100;

  private constructor() {
    this.loadFromStorage();
    this.setupPeriodicCleanup();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private async loadFromStorage(): Promise<void> {
    const data = await chrome.storage.local.get(['predictionCache', 'errorLogs']);
    
    if (data.predictionCache) {
      this.cache = new Map(Object.entries(data.predictionCache));
    }
    
    if (data.errorLogs) {
      this.errorLogs = data.errorLogs;
    }
  }

  private async saveToStorage(): Promise<void> {
    await chrome.storage.local.set({
      predictionCache: Object.fromEntries(this.cache),
      errorLogs: this.errorLogs
    });
  }

  private setupPeriodicCleanup(): void {
    // Clean up expired cache entries every hour
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_EXPIRY) {
        this.cache.delete(key);
      }
    }
    this.saveToStorage();
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