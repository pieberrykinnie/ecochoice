import * as tf from '@tensorflow/tfjs';

// Feature extraction configuration
const FEATURE_CONFIG = {
  // Text-based features
  maxTitleLength: 100,
  maxDescriptionLength: 1000,
  maxFeatures: 50,
  
  // Keyword categories for one-hot encoding
  materialTypes: ['plastic', 'wood', 'metal', 'glass', 'fabric', 'paper', 'organic'],
  certifications: ['energy_star', 'fair_trade', 'organic', 'recyclable'],
  productTypes: ['digital', 'electronic', 'household', 'clothing', 'food'],
  
  // Numerical features
  numericalFeatures: ['price', 'weight', 'energy_consumption']
};

export interface MLFeatures {
  // Text features
  titleEmbedding: number[];
  descriptionEmbedding: number[];
  
  // Categorical features (one-hot encoded)
  materialType: number[];
  certifications: number[];
  productType: number[];
  
  // Numerical features
  numericalValues: number[];
}

export interface ProductFeatures {
  title: string;
  description: string;
  materials: string[];
  certifications: string[];
  productType: string;
  price?: number;
  weight?: number;
  energyConsumption?: number;
}

// Convert text to word frequency vector
function textToVector(text: string, maxLength: number): number[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .slice(0, maxLength);
  
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // Normalize frequencies
  const total = Object.values(wordFreq).reduce((a, b) => a + b, 0);
  return Object.values(wordFreq).map(freq => freq / total);
}

// One-hot encode categorical features
function oneHotEncode(value: string, categories: string[]): number[] {
  return categories.map(cat => value.toLowerCase().includes(cat.toLowerCase()) ? 1 : 0);
}

// Extract features from product data
export function extractFeatures(product: ProductFeatures): MLFeatures {
  return {
    titleEmbedding: textToVector(product.title, FEATURE_CONFIG.maxTitleLength),
    descriptionEmbedding: textToVector(product.description, FEATURE_CONFIG.maxDescriptionLength),
    
    materialType: product.materials.reduce((acc, material) => {
      const encoded = oneHotEncode(material, FEATURE_CONFIG.materialTypes);
      return acc.map((val, idx) => val + encoded[idx]);
    }, new Array(FEATURE_CONFIG.materialTypes.length).fill(0)),
    
    certifications: product.certifications.reduce((acc, cert) => {
      const encoded = oneHotEncode(cert, FEATURE_CONFIG.certifications);
      return acc.map((val, idx) => val + encoded[idx]);
    }, new Array(FEATURE_CONFIG.certifications.length).fill(0)),
    
    productType: oneHotEncode(product.productType, FEATURE_CONFIG.productTypes),
    
    numericalValues: [
      product.price || 0,
      product.weight || 0,
      product.energyConsumption || 0
    ].map(val => val / 100) // Simple normalization
  };
}

// Create and train the model
export async function createModel(): Promise<tf.LayersModel> {
  const model = tf.sequential();
  
  // Input layer size based on our feature vector size
  const inputSize = 
    FEATURE_CONFIG.maxTitleLength +
    FEATURE_CONFIG.maxDescriptionLength +
    FEATURE_CONFIG.materialTypes.length +
    FEATURE_CONFIG.certifications.length +
    FEATURE_CONFIG.productTypes.length +
    FEATURE_CONFIG.numericalFeatures.length;

  // Add layers
  model.add(tf.layers.dense({
    units: 64,
    activation: 'relu',
    inputShape: [inputSize]
  }));
  
  model.add(tf.layers.dropout({ rate: 0.2 }));
  
  model.add(tf.layers.dense({
    units: 32,
    activation: 'relu'
  }));
  
  model.add(tf.layers.dropout({ rate: 0.1 }));
  
  // Output layer for sustainability score (0-1)
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid'
  }));

  // Compile model
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

// Convert features to tensor
export function featuresToTensor(features: MLFeatures): tf.Tensor {
  const featureArray = [
    ...features.titleEmbedding,
    ...features.descriptionEmbedding,
    ...features.materialType,
    ...features.certifications,
    ...features.productType,
    ...features.numericalValues
  ];
  
  return tf.tensor2d([featureArray]);
}

// Train model with collected data
export async function trainModel(
  model: tf.LayersModel,
  features: MLFeatures[],
  labels: number[],
  epochs: number = 50
): Promise<tf.History> {
  const xs = tf.concat(
    features.map(f => featuresToTensor(f))
  );
  
  const ys = tf.tensor2d(labels.map(l => [l]));
  
  const history = await model.fit(xs, ys, {
    epochs,
    validationSplit: 0.2,
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch}: loss = ${logs?.loss.toFixed(4)}, accuracy = ${logs?.acc.toFixed(4)}`);
      }
    }
  });

  // Clean up tensors
  xs.dispose();
  ys.dispose();
  
  return history;
}

// Predict sustainability score
export async function predictScore(
  model: tf.LayersModel,
  features: MLFeatures
): Promise<number> {
  const inputTensor = featuresToTensor(features);
  const prediction = await model.predict(inputTensor) as tf.Tensor;
  const score = (await prediction.data())[0];
  
  // Clean up tensors
  inputTensor.dispose();
  prediction.dispose();
  
  return score;
}

// Save model to IndexedDB
export async function saveModel(model: tf.LayersModel): Promise<void> {
  await model.save('indexeddb://ecochoice-sustainability-model');
}

// Load model from IndexedDB
export async function loadModel(): Promise<tf.LayersModel | null> {
  try {
    return await tf.loadLayersModel('indexeddb://ecochoice-sustainability-model');
  } catch (error) {
    console.warn('No saved model found:', error);
    return null;
  }
} 