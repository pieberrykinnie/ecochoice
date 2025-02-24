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

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage with default values
  chrome.storage.local.set({
    stats: {
      analyzedProducts: 0,
      averageScore: 0,
      totalCO2Saved: 0
    },
    settings: {
      autoAnalyze: true,
      notificationsEnabled: true,
      sustainabilityThreshold: 0.7
    }
  })
})

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if the URL matches supported e-commerce sites
    const supportedSites = [
      'amazon.com',
      'etsy.com',
      'ebay.com'
    ]

    const isProductPage = supportedSites.some(site => 
      tab.url.includes(site) && tab.url.includes('/product')
    )

    if (isProductPage) {
      // Notify the content script to analyze the page
      chrome.tabs.sendMessage(tabId, { 
        action: 'ANALYZE_PRODUCT',
        url: tab.url
      })
    }
  }
})

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'UPDATE_STATS') {
    chrome.storage.local.get('stats', (data) => {
      const currentStats = data.stats || {
        analyzedProducts: 0,
        averageScore: 0,
        totalCO2Saved: 0
      }

      const newStats = {
        analyzedProducts: currentStats.analyzedProducts + 1,
        averageScore: (
          (currentStats.averageScore * currentStats.analyzedProducts + request.score) /
          (currentStats.analyzedProducts + 1)
        ),
        totalCO2Saved: currentStats.totalCO2Saved + request.co2Saved
      }

      chrome.storage.local.set({ stats: newStats })

      // Show notification if score is below threshold
      chrome.storage.local.get('settings', (settingsData) => {
        const settings = settingsData.settings || { sustainabilityThreshold: 0.7 }
        if (request.score < settings.sustainabilityThreshold) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Low Sustainability Score',
            message: 'We found some more sustainable alternatives for this product!'
          })
        }
      })
    })
  }
}) 