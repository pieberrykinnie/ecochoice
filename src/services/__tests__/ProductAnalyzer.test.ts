// Mock dependencies first
jest.mock('../MLService');
jest.mock('../CacheService');

import { ProductAnalyzer, RawProductData } from '../ProductAnalyzer';
import { MLService } from '../MLService';
import { CacheService } from '../CacheService';

// Setup mock implementations after imports
const mockMLService = {
  predict: jest.fn().mockResolvedValue(0.85),
  addTrainingData: jest.fn().mockResolvedValue(undefined)
};

const mockCacheService = {
  getCachedPrediction: jest.fn().mockResolvedValue(null),
  cachePrediction: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined),
  stopCleanup: jest.fn().mockResolvedValue(undefined)
};

// Set up mock implementations
(MLService.getInstance as jest.Mock).mockReturnValue(mockMLService);
(CacheService.getInstance as jest.Mock).mockResolvedValue(mockCacheService);

describe('ProductAnalyzer', () => {
  let analyzer: ProductAnalyzer;

  const mockProduct: RawProductData = {
    title: 'Eco-friendly Laptop',
    description: 'Energy Star certified laptop made from recycled materials. ' +
                'Consumes only 45W of power. Weight: 1.5 kg. ' +
                'Features modular design for easy repairs.',
    price: 999.99,
    url: 'https://example.com/eco-laptop',
    specifications: {
      'processor': 'Eco CPU 2.4GHz',
      'memory': '16GB',
      'storage': '512GB SSD'
    },
    seller: {
      name: 'Green Electronics',
      rating: 4.8
    }
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset singleton instance
    (ProductAnalyzer as any).instance = null;
    analyzer = ProductAnalyzer.getInstance();
    await analyzer.initialize();
  });

  afterEach(async () => {
    // Clean up any timers
    jest.clearAllTimers();
    jest.useRealTimers();
    // Stop cleanup interval in CacheService
    await mockCacheService.stopCleanup();
  });

  afterAll(() => {
    // Ensure all mocks are restored
    jest.restoreAllMocks();
  });

  describe('product analysis', () => {
    it('should analyze a product and return detailed metrics', async () => {
      const analysis = await analyzer.analyzeProduct(mockProduct);

      expect(analysis).toEqual(expect.objectContaining({
        overallScore: expect.any(Number),
        metrics: expect.objectContaining({
          carbonFootprint: expect.any(Number),
          recycledMaterials: expect.any(Number),
          sustainablePackaging: expect.any(Number),
          manufacturingImpact: expect.any(Number),
          energyEfficiency: expect.any(Number),
          repairability: expect.any(Number)
        }),
        confidence: expect.any(Number),
        alternatives: expect.arrayContaining([
          expect.objectContaining({
            title: expect.any(String),
            url: expect.any(String),
            score: expect.any(Number),
            priceRange: expect.any(Array)
          })
        ]),
        certifications: expect.any(Array),
        recommendations: expect.any(Array),
        timestamp: expect.any(Number)
      }));
    });

    it('should return cached analysis if available', async () => {
      const cachedAnalysis = {
        overallScore: 0.9,
        metrics: {
          carbonFootprint: 45,
          recycledMaterials: 0.8,
          sustainablePackaging: 0.7,
          manufacturingImpact: 0.85,
          energyEfficiency: 0.9,
          repairability: 0.95
        },
        confidence: 0.85,
        alternatives: [],
        certifications: [],
        recommendations: [],
        timestamp: Date.now()
      };

      mockCacheService.getCachedPrediction.mockResolvedValueOnce(cachedAnalysis);
      
      const analysis = await analyzer.analyzeProduct(mockProduct);
      expect(analysis).toEqual(cachedAnalysis);
      expect(mockCacheService.getCachedPrediction).toHaveBeenCalled();
    });

    it('should detect product type correctly', async () => {
      const analysis = await analyzer.analyzeProduct(mockProduct);
      const features = (analyzer as any).extractFeatures(mockProduct);
      expect(features.productType).toBe('electronics');
    });

    it('should extract materials from product description', async () => {
      const analysis = await analyzer.analyzeProduct(mockProduct);
      const features = (analyzer as any).extractFeatures(mockProduct);
      expect(features.materials).toContain('recycled');
    });

    it('should calculate energy consumption from product description', async () => {
      const analysis = await analyzer.analyzeProduct(mockProduct);
      const features = (analyzer as any).extractFeatures(mockProduct);
      expect(features.energyConsumption).toBe(45); // 45W from description
    });

    it('should extract weight from product description', async () => {
      const analysis = await analyzer.analyzeProduct(mockProduct);
      const features = (analyzer as any).extractFeatures(mockProduct);
      expect(features.weight).toBe(1.5); // 1.5kg from description
    });

    it('should generate relevant recommendations', async () => {
      const analysis = await analyzer.analyzeProduct(mockProduct);
      expect(analysis.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('energy-efficient'),
          expect.stringContaining('recycled')
        ])
      );
    });
  });

  describe('error handling', () => {
    it('should log errors and rethrow', async () => {
      const error = new Error('Analysis failed');
      (MLService.getInstance() as any).predict.mockRejectedValueOnce(error);

      await expect(analyzer.analyzeProduct(mockProduct)).rejects.toThrow('Analysis failed');
      expect(mockCacheService.logError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          context: 'analyzeProduct',
          product: mockProduct.url
        })
      );
    });

    it('should handle missing product data gracefully', async () => {
      const minimalProduct: RawProductData = {
        title: 'Simple Product',
        description: 'Basic description',
        price: 10,
        url: 'https://example.com/simple'
      };

      const analysis = await analyzer.analyzeProduct(minimalProduct);
      expect(analysis.confidence).toBeLessThan(0.8); // Lower confidence due to minimal data
    });
  });

  describe('certification verification', () => {
    it('should verify known certifications', async () => {
      const productWithCert: RawProductData = {
        ...mockProduct,
        description: 'Energy Star certified and Fair Trade approved laptop'
      };

      const analysis = await analyzer.analyzeProduct(productWithCert);
      expect(analysis.certifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('energy star'),
            verified: true
          })
        ])
      );
    });

    it('should mark unknown certifications as unverified', async () => {
      const productWithUnknownCert: RawProductData = {
        ...mockProduct,
        description: 'XYZ certified laptop'
      };

      const analysis = await analyzer.analyzeProduct(productWithUnknownCert);
      const unknownCert = analysis.certifications.find(c => c.name.includes('xyz'));
      expect(unknownCert?.verified).toBe(false);
    });
  });
}); 