import * as tf from '@tensorflow/tfjs';
import { MLService } from '../src/services/MLService';

// Initialize ML service
let mlService = null;

async function initializeML() {
  mlService = MLService.getInstance();
  await mlService.initialize();
  console.log('ML service initialized');
}

// Initialize when extension starts
initializeML();

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

// Analyze product sustainability using ML and heuristics
async function analyzeProduct(product) {
  try {
    // Extract features for ML
    const productFeatures = {
      title: product.name,
      description: product.description,
      materials: extractMaterials(product),
      certifications: extractCertifications(product),
      productType: detectProductType(product),
      price: parseFloat(product.price?.replace(/[^0-9.]/g, '') || '0'),
      weight: extractWeight(product),
      energyConsumption: estimateEnergyConsumption(product)
    };

    // Get ML prediction if available
    let mlScore = 0.5;
    if (mlService) {
      try {
        mlScore = await mlService.predict(productFeatures);
      } catch (error) {
        console.warn('ML prediction failed:', error);
      }
    }

    // Calculate basic score as fallback
    const basicScore = calculateBasicScore(
      `${product.name} ${product.description}`
    );

    // Combine scores (giving more weight to ML score when available)
    const finalScore = mlService ? (0.7 * mlScore + 0.3 * basicScore) : basicScore;

    // Add to training data
    if (mlService) {
      await mlService.addTrainingData(productFeatures, finalScore);
    }

    return {
      score: finalScore,
      confidence: mlService ? 'high' : 'medium',
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

// Helper functions for feature extraction
function extractMaterials(product) {
  const materials = [];
  const text = `${product.name} ${product.description}`.toLowerCase();
  
  const materialPatterns = [
    'made from', 'made of', 'material:', 'materials:',
    'contains', 'using', 'constructed with'
  ];

  materialPatterns.forEach(pattern => {
    const index = text.indexOf(pattern);
    if (index !== -1) {
      const segment = text.slice(index + pattern.length, index + 100);
      const words = segment.split(/[,\s]+/);
      materials.push(...words.slice(0, 3));
    }
  });

  return Array.from(new Set(materials));
}

function extractCertifications(product) {
  const certifications = [];
  const text = `${product.name} ${product.description}`.toLowerCase();
  
  const certPatterns = [
    'certified', 'certified by', 'certification:',
    'compliant with', 'meets', 'approved by'
  ];

  certPatterns.forEach(pattern => {
    const index = text.indexOf(pattern);
    if (index !== -1) {
      const segment = text.slice(index + pattern.length, index + 100);
      const words = segment.split(/[,\s]+/);
      certifications.push(...words.slice(0, 2));
    }
  });

  return Array.from(new Set(certifications));
}

function detectProductType(product) {
  const text = `${product.name} ${product.description}`.toLowerCase();
  
  const typePatterns = {
    digital: ['ebook', 'digital download', 'software'],
    electronic: ['laptop', 'computer', 'device'],
    household: ['furniture', 'appliance', 'decor'],
    clothing: ['shirt', 'pants', 'dress'],
    food: ['food', 'beverage', 'snack']
  };

  for (const [type, patterns] of Object.entries(typePatterns)) {
    if (patterns.some(p => text.includes(p))) {
      return type;
    }
  }

  return 'other';
}

function extractWeight(product) {
  const text = `${product.name} ${product.description}`;
  const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|lbs?|ounces?)/i);
  
  if (weightMatch) {
    const value = parseFloat(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase();
    
    // Convert to kg
    switch (unit) {
      case 'g': return value / 1000;
      case 'lb':
      case 'lbs': return value * 0.45359237;
      case 'ounce':
      case 'ounces': return value * 0.0283495;
      default: return value;
    }
  }
  
  return 0;
}

function estimateEnergyConsumption(product) {
  const text = `${product.name} ${product.description}`.toLowerCase();
  
  // Look for energy consumption indicators
  const consumptionMatch = text.match(/(\d+(?:\.\d+)?)\s*(w|watts?|kw|kilowatts?)/i);
  
  if (consumptionMatch) {
    const value = parseFloat(consumptionMatch[1]);
    const unit = consumptionMatch[2].toLowerCase();
    
    // Convert to watts
    return unit.startsWith('k') ? value * 1000 : value;
  }
  
  // Estimate based on product type
  if (text.includes('laptop')) return 65;
  if (text.includes('desktop')) return 200;
  if (text.includes('tv')) return 100;
  if (text.includes('refrigerator')) return 150;
  
  return 0;
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeProduct') {
    analyzeProduct(request.product).then(result => {
      sendResponse(result);
    });
    return true; // Will respond asynchronously
  }
});

// Update stats when analysis is complete
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'UPDATE_STATS') {
    chrome.storage.local.get('stats', (data) => {
      const currentStats = data.stats || {
        analyzedProducts: 0,
        averageScore: 0,
        totalCO2Saved: 0
      };

      const newStats = {
        analyzedProducts: currentStats.analyzedProducts + 1,
        averageScore: (
          (currentStats.averageScore * currentStats.analyzedProducts + request.score) /
          (currentStats.analyzedProducts + 1)
        ),
        totalCO2Saved: currentStats.totalCO2Saved + (request.score > 0.7 ? 2.5 : 1.0)
      };

      chrome.storage.local.set({ stats: newStats });

      // Show notification if score is below threshold
      chrome.storage.local.get('settings', (settingsData) => {
        const settings = settingsData.settings || { sustainabilityThreshold: 0.7 };
        if (request.score < settings.sustainabilityThreshold) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Low Sustainability Score',
            message: 'We found some more sustainable alternatives for this product!'
          });
        }
      });
    });
  }
});

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