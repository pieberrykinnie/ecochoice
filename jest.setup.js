require('@testing-library/jest-dom');

// Mock Chrome API
global.chrome = {
  storage: {
    local: {
      get: jest.fn((key) => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve())
    }
  }
};

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs-node', () => ({
  sequential: jest.fn(),
  layers: {
    dense: jest.fn(),
    dropout: jest.fn()
  },
  train: {
    adam: jest.fn()
  },
  tensor2d: jest.fn(),
  concat: jest.fn(),
  loadLayersModel: jest.fn(),
  data: jest.fn()
})); 