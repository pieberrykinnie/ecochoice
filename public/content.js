// Product data selectors for different e-commerce sites
const SELECTORS = {
  amazon: {
    name: '#productTitle',
    price: '.a-price-whole',
    description: '#productDescription',
    image: '#landingImage'
  },
  etsy: {
    name: '.wt-text-body-03',
    price: '.wt-text-title-03',
    description: '.wt-text-body-01',
    image: '.wt-max-width-full'
  },
  ebay: {
    name: '#itemTitle',
    price: '#prcIsum',
    description: '#itemDescription',
    image: '#icImg'
  }
};

// Extract product information from the page
function extractProductInfo() {
  const host = window.location.hostname;
  let selectors;
  
  if (host.includes('amazon')) {
    selectors = SELECTORS.amazon;
  } else if (host.includes('etsy')) {
    selectors = SELECTORS.etsy;
  } else if (host.includes('ebay')) {
    selectors = SELECTORS.ebay;
  } else {
    return null;
  }

  return {
    name: document.querySelector(selectors.name)?.textContent?.trim(),
    price: document.querySelector(selectors.price)?.textContent?.trim(),
    description: document.querySelector(selectors.description)?.textContent?.trim(),
    image: document.querySelector(selectors.image)?.src,
    url: window.location.href
  };
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProductInfo') {
    const productInfo = extractProductInfo();
    sendResponse({ productInfo });
  }
});

// Inject the sustainability badge into the page
function injectSustainabilityBadge(score) {
  const badge = document.createElement('div');
  badge.className = 'eco-choice-badge';
  badge.innerHTML = `
    <div class="eco-score">
      <span class="score-label">Eco Score</span>
      <span class="score-value">${Math.round(score * 100)}%</span>
    </div>
  `;

  // Find a suitable location to inject the badge
  const targetElement = document.querySelector(
    '[data-testid="add-to-cart-button"]' // Amazon example
  );

  if (targetElement) {
    targetElement.parentNode.insertBefore(badge, targetElement);
  }
}

// Initialize content script
function init() {
  // Add custom styles
  const style = document.createElement('style');
  style.textContent = `
    .eco-choice-badge {
      background: #f0fdf4;
      border: 1px solid #16a34a;
      border-radius: 8px;
      padding: 12px;
      margin: 12px 0;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    .eco-score {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .score-label {
      color: #166534;
      font-weight: 500;
    }
    
    .score-value {
      background: #16a34a;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
  `;
  
  document.head.appendChild(style);

  // Extract product info and request analysis
  const productInfo = extractProductInfo();
  if (productInfo) {
    chrome.runtime.sendMessage(
      { action: 'analyzeProduct', product: productInfo },
      response => {
        if (response.score) {
          injectSustainabilityBadge(response.score);
        }
      }
    );
  }
}

// Run initialization when the page is ready
if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
} 