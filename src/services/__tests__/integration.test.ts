import { ProductAnalyzer } from '../ProductAnalyzer';
import { MLService } from '../MLService';
import { MLMetricsService } from '../MLMetricsService';
import { CacheService } from '../CacheService';

// Mock all services
jest.mock('../MLService');
jest.mock('../CacheService');
jest.mock('../MLMetricsService');

describe('Integration Tests', () => {
  let productAnalyzer: ProductAnalyzer;
  let mlService: jest.Mocked<MLService>;
  let mlMetricsService: jest.Mocked<MLMetricsService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockProduct = {
    title: 'Eco-friendly Laptop',
    description: 'Energy Star certified laptop made from recycled materials. ' +
                'Consumes only 45W of power. Weight: 1.5 kg.',
    price: 999.99,
    url: 'https://example.com/eco-laptop'
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup MLService mock
    mlService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      predict: jest.fn().mockResolvedValue(0.85),
      addTrainingData: jest.fn().mockResolvedValue(undefined),
      getModelMetrics: jest.fn().mockResolvedValue({
        dataPoints: 100,
        lastTraining: new Date().toISOString(),
        accuracy: 0.85
      })
    } as any;
    (MLService.getInstance as jest.Mock).mockReturnValue(mlService);

    // Setup MLMetricsService mock
    mlMetricsService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      updateMetrics: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockResolvedValue({
        modelVersion: '1.0.0',
        lastTrainingDate: Date.now(),
        totalPredictions: 0,
        accuracyScore: 0.85,
        confidenceThreshold: 0.7,
        dataPoints: 0,
        trainingHistory: []
      })
    } as any;
    (MLMetricsService.getInstance as jest.Mock).mockReturnValue(mlMetricsService);

    // Setup CacheService mock
    cacheService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getCachedPrediction: jest.fn().mockResolvedValue(null),
      cachePrediction: jest.fn().mockResolvedValue(undefined),
      logError: jest.fn().mockResolvedValue(undefined)
    } as any;
    (CacheService.getInstance as jest.Mock).mockReturnValue(cacheService);

    // Initialize ProductAnalyzer
    (ProductAnalyzer as any).instance = null;
    productAnalyzer = ProductAnalyzer.getInstance();
    
    (productAnalyzer as any).mlService = mlService;
    (productAnalyzer as any).mlMetricsService = mlMetricsService;
    (productAnalyzer as any).cacheService = cacheService;
    
    await productAnalyzer.initialize();
  });

  it('should perform complete product analysis flow', async () => {
    // Analyze product
    const analysis = await productAnalyzer.analyzeProduct(mockProduct);

    // Verify ML prediction was called
    expect(mlService.predict).toHaveBeenCalled();

    // Verify metrics were updated
    expect(mlMetricsService.updateMetrics).toHaveBeenCalledWith(0.85);

    // Verify analysis results
    expect(analysis).toEqual(expect.objectContaining({
      overallScore: 0.85,
      confidence: expect.any(Number),
      metrics: expect.objectContaining({
        carbonFootprint: expect.any(Number),
        recycledMaterials: expect.any(Number),
        sustainablePackaging: expect.any(Number),
        manufacturingImpact: expect.any(Number),
        energyEfficiency: expect.any(Number),
        repairability: expect.any(Number)
      }),
      recommendations: expect.arrayContaining([
        expect.stringContaining('energy-efficient'),
        expect.stringContaining('recycled')
      ])
    }));

    // Verify result was cached
    expect(cacheService.cachePrediction).toHaveBeenCalled();
  });

  it('should handle analysis with cached results', async () => {
    // Setup cached result
    const cachedAnalysis = {
      overallScore: 0.9,
      confidence: 0.85,
      metrics: {
        carbonFootprint: 45,
        recycledMaterials: 0.8,
        sustainablePackaging: 0.7,
        manufacturingImpact: 0.85,
        energyEfficiency: 0.9,
        repairability: 0.95
      },
      recommendations: [
        'Look for more energy-efficient alternatives',
        'Look for products with recycled materials'
      ],
      timestamp: Date.now()
    };

    cacheService.getCachedPrediction.mockResolvedValueOnce(cachedAnalysis as any);

    // Analyze product
    const analysis = await productAnalyzer.analyzeProduct(mockProduct);

    // Verify cached result was used
    expect(mlService.predict).not.toHaveBeenCalled();
    expect(analysis).toEqual(expect.objectContaining(cachedAnalysis));
  });

  it('should handle ML service failure gracefully', async () => {
    // Make ML service fail
    mlService.predict.mockRejectedValueOnce(new Error('ML service unavailable'));

    // Analyze product
    const analysis = await productAnalyzer.analyzeProduct(mockProduct);

    // Verify fallback behavior
    expect(analysis.confidence).toBe(0.6);
    expect(cacheService.logError).toHaveBeenCalled();
    expect(analysis.recommendations).toBeDefined();
    expect(analysis.metrics).toBeDefined();
    
    // Ensure the overall score is within range
    expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
    expect(analysis.overallScore).toBeLessThanOrEqual(1);
  });

  it('should extract correct features from product', async () => {
    // Clear all mocks to ensure we capture the latest calls
    jest.clearAllMocks();
    
    // Analyze product
    await productAnalyzer.analyzeProduct(mockProduct);

    // Verify feature extraction
    expect(mlService.predict).toHaveBeenCalled();
    
    // Get the actual call arguments
    const predictCall = mlService.predict.mock.calls[0][0];
    
    // Verify essential properties match
    expect(predictCall).toMatchObject({
      title: mockProduct.title,
      description: mockProduct.description,
      price: mockProduct.price
    });
    
    // Verify extracted features
    expect(predictCall.productType).toBe('electronics');
    expect(predictCall.materials).toEqual(expect.arrayContaining(['recycled']));
    expect(predictCall.certifications).toEqual(expect.arrayContaining(['energy star']));
    expect(predictCall.weight).toBeGreaterThan(0);
    expect(predictCall.energyConsumption).toBeGreaterThan(0);
  });
}); 