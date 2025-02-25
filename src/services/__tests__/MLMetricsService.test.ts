import { MLMetricsService } from '../MLMetricsService';
import { MLService } from '../MLService';

// Mock MLService
jest.mock('../MLService', () => ({
  MLService: {
    getInstance: jest.fn().mockReturnValue({
      getModelMetrics: jest.fn().mockResolvedValue({
        dataPoints: 100,
        lastTraining: new Date().toISOString(),
        accuracy: 0.85
      })
    })
  }
}));

describe('MLMetricsService', () => {
  let metricsService: MLMetricsService;

  beforeEach(async () => {
    jest.useFakeTimers();
    // Reset singleton instance
    (MLMetricsService as any).instance = null;
    metricsService = MLMetricsService.getInstance();
    await metricsService.initialize();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    metricsService.stopPeriodicUpdate();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with default metrics', async () => {
    const metrics = await metricsService.getMetrics();
    expect(metrics).toEqual(expect.objectContaining({
      modelVersion: '1.0.0',
      totalPredictions: 0,
      accuracyScore: 0.85,
      confidenceThreshold: 0.7,
      dataPoints: 0,
      trainingHistory: []
    }));
  });

  it('should update metrics after prediction', async () => {
    await metricsService.updateMetrics(0.8);
    const metrics = await metricsService.getMetrics();
    expect(metrics.totalPredictions).toBe(1);
  });

  it('should update accuracy when actual score is provided', async () => {
    await metricsService.updateMetrics(0.8, 0.9);
    const metrics = await metricsService.getMetrics();
    expect(metrics.accuracyScore).not.toBe(0.85); // Should be updated based on error
  });

  it('should record training history', async () => {
    await metricsService.recordTraining(0.9, 0.1);
    const metrics = await metricsService.getMetrics();
    expect(metrics.trainingHistory).toHaveLength(1);
    expect(metrics.trainingHistory[0]).toEqual(expect.objectContaining({
      accuracy: 0.9,
      loss: 0.1,
      timestamp: expect.any(Number)
    }));
  });

  it('should limit training history to 100 entries', async () => {
    // Add 110 training records
    for (let i = 0; i < 110; i++) {
      await metricsService.recordTraining(0.9, 0.1);
    }
    
    const metrics = await metricsService.getMetrics();
    expect(metrics.trainingHistory).toHaveLength(100);
  });

  it('should persist metrics to storage', async () => {
    await metricsService.updateMetrics(0.8);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        mlMetrics: expect.any(Object)
      })
    );
  });

  it('should load metrics from storage', async () => {
    const storedMetrics = {
      modelVersion: '1.0.0',
      lastTrainingDate: Date.now(),
      totalPredictions: 50,
      accuracyScore: 0.92,
      confidenceThreshold: 0.7,
      dataPoints: 100,
      trainingHistory: []
    };

    (chrome.storage.local.get as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({ mlMetrics: storedMetrics })
    );

    // Reset and reinitialize service
    (MLMetricsService as any).instance = null;
    metricsService = MLMetricsService.getInstance();
    await metricsService.initialize();

    const metrics = await metricsService.getMetrics();
    expect(metrics).toEqual(expect.objectContaining(storedMetrics));
  });

  it('should update metrics periodically', async () => {
    const mockGetModelMetrics = MLService.getInstance().getModelMetrics as jest.Mock;
    mockGetModelMetrics.mockResolvedValue({
      dataPoints: 150,
      lastTraining: new Date().toISOString(),
      accuracy: 0.88
    });

    // Advance timer by update interval
    jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour

    // Wait for any pending promises
    await Promise.resolve();

    const metrics = await metricsService.getMetrics();
    expect(metrics.dataPoints).toBe(150);
  });

  it('should stop periodic updates when requested', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    metricsService.stopPeriodicUpdate();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
}); 