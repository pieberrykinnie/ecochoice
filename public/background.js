import * as tf from '@tensorflow/tfjs';

// Load the pre-trained model
let model = null;
async function loadModel() {
  try {
    model = await tf.loadLayersModel(chrome.runtime.getURL('models/sustainability-classifier.json'));
    console.log('Sustainability model loaded successfully');
  } catch (error) {
    console.error('Failed to load sustainability model:', error);
  }
}

// Initialize the model when the extension starts
loadModel();

// Keywords and patterns for sustainability analysis
const SUSTAINABILITY_PATTERNS = {
  positive: [
    'organic',
    'sustainable',
    'eco-friendly',
    'recycled',
    'biodegradable',
    'renewable',
    'fair trade',
    'energy efficient',
    'zero waste',
    'carbon neutral'
  ],
  negative: [
    'synthetic',
    'plastic',
    'disposable',
    'non-recyclable',
    'petroleum-based',
    'toxic',
    'harmful'
  ]
};

// Calculate basic sustainability score based on keywords
function calculateBasicScore(text) {
  const lowerText = text.toLowerCase();
  let score = 0.5; // Base score

  // Count positive indicators
  SUSTAINABILITY_PATTERNS.positive.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      score += 0.1;
    }
  });

  // Count negative indicators
  SUSTAINABILITY_PATTERNS.negative.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      score -= 0.1;
    }
  });

  // Clamp score between 0 and 1
  return Math.max(0, Math.min(1, score));
}

// Process product text for TensorFlow model
function preprocessText(text) {
  // Basic text preprocessing
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .slice(0, 100) // Limit to first 100 words
    .join(' ');
}

// Analyze product sustainability
async function analyzeProduct(product) {
  try {
    // Basic score based on keywords
    const basicScore = calculateBasicScore(
      `${product.name} ${product.description}`
    );

    // If model is available, use it for advanced analysis
    let modelScore = basicScore;
    if (model) {
      const processedText = preprocessText(
        `${product.name} ${product.description}`
      );
      const prediction = await model.predict(tf.tensor([processedText]));
      modelScore = prediction.dataSync()[0];
    }

    // Combine scores (giving more weight to the model score if available)
    const finalScore = model ? (0.3 * basicScore + 0.7 * modelScore) : basicScore;

    return {
      score: finalScore,
      confidence: model ? 'high' : 'medium',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error analyzing product:', error);
    return {
      score: calculateBasicScore(`${product.name} ${product.description}`),
      confidence: 'low',
      timestamp: Date.now()
    };
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeProduct') {
    analyzeProduct(request.product)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('Analysis error:', error);
        sendResponse({ error: 'Failed to analyze product' });
      });
    return true; // Required for async response
  }
}); 