import '@testing-library/jest-dom';
import * as tf from '@tensorflow/tfjs-node';

// Add missing DOM APIs
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
}

// Mock timer functions
const mockSetInterval = jest.fn() as unknown as typeof setInterval;
const mockClearInterval = jest.fn() as unknown as typeof clearInterval;
global.setInterval = mockSetInterval;
global.clearInterval = mockClearInterval;

// Mock Chrome API with proper types
interface MockStorage {
  mlTrainingData: any[];
  predictionCache: Record<string, any>;
  errorLogs: any[];
  [key: string]: any;
}

const mockStorage: MockStorage = {
  mlTrainingData: [],
  predictionCache: {},
  errorLogs: [],
  modelAccuracy: 0.85,
  lastTraining: Date.now(),
  trainingHistory: []
};

const chrome = {
  storage: {
    local: {
      get: jest.fn().mockImplementation((key: string | string[] | null) => {
        if (typeof key === 'string') {
          return Promise.resolve({ [key]: mockStorage[key] });
        }
        if (Array.isArray(key)) {
          const result: Record<string, any> = {};
          key.forEach(k => {
            result[k] = mockStorage[k];
          });
          return Promise.resolve(result);
        }
        return Promise.resolve(mockStorage);
      }),
      set: jest.fn().mockImplementation((data: Record<string, any>) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      })
    }
  }
};

(global as any).chrome = chrome;

// Configure TensorFlow.js to use the Node.js backend
tf.setBackend('tensorflow');

// Mock TensorFlow.js methods with proper types
jest.mock('@tensorflow/tfjs-node', () => {
  const mockTensor = {
    data: jest.fn().mockResolvedValue([0.75]),
    dispose: jest.fn(),
    shape: [1, 1],
    dataSync: jest.fn().mockReturnValue([0.75])
  };

  const mockModel = {
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({
      history: {
        acc: [0.8],
        loss: [0.2]
      }
    }),
    predict: jest.fn().mockReturnValue(mockTensor),
    save: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn()
  };

  return {
    setBackend: jest.fn(),
    sequential: jest.fn().mockReturnValue(mockModel),
    layers: {
      dense: jest.fn().mockReturnValue({}),
      dropout: jest.fn().mockReturnValue({})
    },
    train: {
      adam: jest.fn().mockReturnValue({})
    },
    tensor2d: jest.fn().mockReturnValue(mockTensor),
    concat: jest.fn().mockReturnValue(mockTensor),
    loadLayersModel: jest.fn().mockResolvedValue(mockModel)
  };
}); 