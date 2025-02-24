import React, { useState, useEffect } from 'react'

interface TabInfo {
  url: string
  title: string
}

interface AmazonProduct {
  title: string
  price: string
  description: string
  features: string[]
  materials: string
  packaging: string
  weight: string
  manufacturer: string
}

interface SustainabilityAnalysis {
  score: number
  factors: string[]
}

interface AnalysisResult {
  productInfo: AmazonProduct
  sustainabilityScore: number
  factors: string[]
}

export default function PopupPage() {
  const [currentTab, setCurrentTab] = useState<TabInfo | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [stats, setStats] = useState({
    analyzedProducts: 0,
    averageScore: 0,
    totalCO2Saved: 0
  })

  useEffect(() => {
    // Get current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setCurrentTab({
          url: tabs[0].url || '',
          title: tabs[0].title || ''
        })
      }
    })

    // Load saved stats
    chrome.storage.local.get('stats', (data) => {
      if (data.stats) {
        setStats(data.stats)
      }
    })
  }, [])

  const handleAnalyzeClick = async () => {
    if (!currentTab) return
    
    setIsAnalyzing(true)
    try {
      // Get the current tab ID
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) return

      // First check if we're on an Amazon product page
      if (!tab.url?.includes('amazon')) {
        throw new Error('Not an Amazon product page')
      }

      // Inject the content script and get analysis results
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: analyzeProduct,
        world: 'MAIN' // Execute in the main world to access page's DOM
      })

      // Check if we got valid results
      if (!results || results.length === 0 || !results[0].result) {
        throw new Error('Failed to analyze product')
      }

      const analysis = results[0].result
      
      // Update stats with actual analysis data
      const newStats = {
        analyzedProducts: stats.analyzedProducts + 1,
        averageScore: (stats.averageScore * stats.analyzedProducts + analysis.sustainabilityScore) / (stats.analyzedProducts + 1),
        // Estimate CO2 savings based on score improvement
        totalCO2Saved: stats.totalCO2Saved + (analysis.sustainabilityScore > 0.7 ? 2.5 : 1.0)
      }
      setStats(newStats)
      chrome.storage.local.set({ stats: newStats })

      // Close the popup
      window.close()
      
    } catch (error) {
      console.error('Analysis failed:', error)
      // Keep the popup open on error
      setIsAnalyzing(false)
      // TODO: Show error message to user
    }
  }

  return (
    <div className="w-96 p-4">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold text-green-700 mb-2">EcoChoice</h1>
        <p className="text-sm text-gray-600">
          Make sustainable shopping decisions
        </p>
      </header>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Current Page</h2>
        {currentTab ? (
          <div className="text-sm text-gray-700 truncate">
            {currentTab.title}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            No product page detected
          </div>
        )}
      </div>

      <div className="mb-6">
        <button
          onClick={handleAnalyzeClick}
          disabled={isAnalyzing || !currentTab}
          className={`w-full py-2 px-4 rounded-lg ${
            isAnalyzing || !currentTab
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          } transition-colors`}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Product'}
        </button>
      </div>

      <div className="border-t pt-4">
        <h2 className="text-lg font-semibold mb-3">Your Impact</h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Products Analyzed:</span>
            <span className="font-medium">{stats.analyzedProducts}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Average Score:</span>
            <span className="font-medium">
              {(stats.averageScore * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">CO2 Saved:</span>
            <span className="font-medium">
              {stats.totalCO2Saved.toFixed(1)} kg
            </span>
          </div>
        </div>
      </div>

      <footer className="mt-6 pt-4 border-t text-center">
        <a
          href="https://sdgs.un.org/goals/goal12"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-green-600 hover:text-green-700"
        >
          Supporting UN SDG 12: Responsible Consumption
        </a>
      </footer>
    </div>
  )
}

// This function will be injected into the page
function analyzeProduct(): AnalysisResult {
  // Extract product information based on the current URL
  function extractAmazonProduct(): AmazonProduct {
    // Try different selectors for product title
    const title = 
      document.querySelector('#productTitle')?.textContent?.trim() ||
      document.querySelector('.product-title-word-break')?.textContent?.trim() ||
      ''

    // Try different selectors for price
    const price = 
      document.querySelector('.a-price .a-offscreen')?.textContent?.trim() ||
      document.querySelector('#price_inside_buybox')?.textContent?.trim() ||
      document.querySelector('#priceblock_ourprice')?.textContent?.trim() ||
      ''

    // Try different selectors for description
    const description = 
      document.querySelector('#productDescription p')?.textContent?.trim() ||
      document.querySelector('#feature-bullets')?.textContent?.trim() ||
      ''

    // Get product features
    const features = [
      ...Array.from(document.querySelectorAll('#feature-bullets li span')),
      ...Array.from(document.querySelectorAll('.a-unordered-list .a-list-item'))
    ]
      .map(el => el.textContent?.trim())
      .filter((text): text is string => text !== undefined && text !== null)

    // Try different selectors for specifications
    const specRows = [
      ...Array.from(document.querySelectorAll('#productDetails_techSpec_section_1 tr')),
      ...Array.from(document.querySelectorAll('#productDetails_detailBullets_sections1 tr')),
      ...Array.from(document.querySelectorAll('.product-facts-detail tr'))
    ]

    const specifications = Object.fromEntries(
      specRows.map(row => [
        row.querySelector('th, .label')?.textContent?.trim() || '',
        row.querySelector('td, .value')?.textContent?.trim() || ''
      ])
    )

    // Extract specific details
    const materials = 
      specifications['Material'] || 
      specifications['Materials'] || 
      specifications['Material Type'] ||
      specifications['Material Composition'] ||
      ''

    const packaging = 
      specifications['Package Dimensions'] ||
      specifications['Product Dimensions'] ||
      specifications['Item Package Dimensions'] ||
      ''

    const weight = 
      specifications['Item Weight'] ||
      specifications['Weight'] ||
      specifications['Product Weight'] ||
      ''

    const manufacturer = 
      specifications['Manufacturer'] ||
      specifications['Brand'] ||
      specifications['Sold by'] ||
      ''

    // Log extracted data for debugging
    console.log('Extracted product data:', {
      title,
      price,
      description: description.slice(0, 100) + '...',
      featuresCount: features.length,
      materials,
      packaging,
      weight,
      manufacturer
    })

    return {
      title,
      price,
      description,
      features,
      materials,
      packaging,
      weight,
      manufacturer
    }
  }

  // Analyze sustainability based on product attributes
  function analyzeSustainability(product: AmazonProduct): SustainabilityAnalysis {
    let score = 0.5 // Base score
    let factors = []
    
    type CategoryName = 'materials' | 'energy' | 'packaging' | 'manufacturing' | 'durability'
    type CategoryScores = Record<CategoryName, number>
    
    // Enhanced keywords that indicate sustainability
    const sustainabilityIndicators = {
      materials: {
        positive: [
          'bamboo', 'wood', 'organic', 'recycled', 'natural', 'cotton', 'wool', 'hemp',
          'biodegradable', 'compostable', 'renewable'
        ],
        negative: [
          'plastic', 'synthetic', 'nylon', 'polyester', 'petroleum', 'pvc',
          'non-recyclable', 'toxic', 'chemical'
        ]
      },
      energy: {
        positive: [
          'energy efficient', 'energy star', 'low power', 'solar powered',
          'rechargeable', 'power saving'
        ],
        negative: [
          'high power consumption', 'battery operated', 'batteries required'
        ]
      },
      packaging: {
        positive: [
          'minimal packaging', 'recyclable packaging', 'plastic-free packaging',
          'eco packaging', 'sustainable packaging'
        ],
        negative: [
          'excessive packaging', 'plastic packaging', 'non-recyclable packaging'
        ]
      },
      manufacturing: {
        positive: [
          'fair trade', 'local', 'handmade', 'ethically made', 'sustainable factory',
          'carbon neutral', 'zero waste', 'eco friendly'
        ],
        negative: [
          'overseas production', 'mass produced', 'factory made'
        ]
      },
      durability: {
        positive: [
          'long lasting', 'durable', 'repairable', 'lifetime warranty',
          'high quality', 'sturdy'
        ],
        negative: [
          'disposable', 'single use', 'temporary', 'replacement needed'
        ]
      }
    } as const

    // Check all text content
    const allText = [
      product.title,
      product.description,
      ...product.features,
      product.materials,
      product.manufacturer
    ].join(' ').toLowerCase()

    // Category-specific scoring
    let categoryScores: CategoryScores = {
      materials: 0,
      energy: 0,
      packaging: 0,
      manufacturing: 0,
      durability: 0
    }

    // Analyze each category
    Object.entries(sustainabilityIndicators).forEach(([category, keywords]) => {
      let categoryScore = 0
      
      // Check positive indicators
      keywords.positive.forEach(keyword => {
        if (allText.includes(keyword)) {
          categoryScore += 0.2
          factors.push(`✓ ${category === 'manufacturing' ? 'Uses' : 'Contains'} ${keyword.replace(/-/g, ' ')}`)
        }
      })

      // Check negative indicators
      keywords.negative.forEach(keyword => {
        if (allText.includes(keyword)) {
          categoryScore -= 0.2
          factors.push(`✗ ${category === 'manufacturing' ? 'Uses' : 'Contains'} ${keyword.replace(/-/g, ' ')}`)
        }
      })

      // Clamp category score
      categoryScores[category as CategoryName] = Math.max(-1, Math.min(1, categoryScore))
    })

    // Product type specific adjustments
    if (allText.includes('artificial') || allText.includes('faux')) {
      // Artificial plants/decorations
      categoryScores.durability += 0.3 // Longer lasting than real plants
      factors.push('✓ Long-lasting alternative to natural products')
    }
    
    if (allText.includes('electronic') || allText.includes('laptop') || allText.includes('device')) {
      // Electronics
      categoryScores.energy -= 0.2 // Base penalty for energy consumption
      if (!allText.includes('energy efficient') && !allText.includes('energy star')) {
        factors.push('✗ No energy efficiency certification')
      }
    }

    if (allText.includes('book') || allText.includes('ebook')) {
      // Digital products
      categoryScores.materials += 0.4 // Favor digital over physical
      factors.push('✓ Digital format reduces material waste')
    }

    // Calculate final score with weighted categories
    score = (
      categoryScores.materials * 0.3 +
      categoryScores.energy * 0.2 +
      categoryScores.packaging * 0.15 +
      categoryScores.manufacturing * 0.2 +
      categoryScores.durability * 0.15
    ) + 0.5 // Normalize to 0-1 range

    // Clamp final score
    score = Math.max(0, Math.min(1, score))

    // Sort factors by importance (✓ first, then ✗)
    factors.sort((a, b) => {
      if (a.startsWith('✓') && !b.startsWith('✓')) return -1
      if (!a.startsWith('✓') && b.startsWith('✓')) return 1
      return 0
    })

    return {
      score,
      factors: factors.slice(0, 5) // Keep top 5 most relevant factors
    }
  }

  // Extract product data
  const product = extractAmazonProduct()
  const analysis = analyzeSustainability(product)

  // Create notification UI
  const container = document.createElement('div')
  container.id = 'eco-choice-badge'
  container.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `
  document.body.appendChild(container)

  // Add visual feedback
  const badge = document.createElement('div')
  badge.style.cssText = `
    background: #16a34a;
    color: white;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    flex-direction: column;
    gap: 12px;
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
    max-width: 300px;
    position: relative;
  `

  // Add close button
  const closeButton = document.createElement('button')
  closeButton.innerHTML = '&times;' // Using proper multiplication symbol
  closeButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    font-size: 20px;
    font-weight: 400;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    cursor: pointer;
    transition: background-color 0.2s ease;
    padding: 0;
    margin: 0;
  `
  closeButton.addEventListener('mouseover', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.3)'
  })
  closeButton.addEventListener('mouseout', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.2)'
  })
  closeButton.addEventListener('click', () => {
    badge.style.opacity = '0'
    badge.style.transform = 'translateY(-10px)'
    setTimeout(() => container.remove(), 300)
  })
  badge.appendChild(closeButton)

  // Add loading spinner
  const spinner = document.createElement('div')
  spinner.style.cssText = `
    width: 20px;
    height: 20px;
    border: 2px solid #ffffff;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  `
  const style = document.createElement('style')
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)

  badge.appendChild(spinner)
  badge.appendChild(document.createTextNode('Analyzing product sustainability...'))
  container.appendChild(badge)

  // Animate in
  requestAnimationFrame(() => {
    badge.style.opacity = '1'
    badge.style.transform = 'translateY(0)'
  })

  // Show analysis results
  setTimeout(() => {
    // Remove spinner
    spinner.remove()

    // Update badge content with detailed results
    badge.innerHTML = `
      <button id="eco-choice-close" style="
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        border-radius: 12px;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
        font-size: 20px;
        font-weight: 400;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        cursor: pointer;
        transition: background-color 0.2s ease;
        padding: 0;
        margin: 0;
      ">&times;</button>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="font-size: 18px;">🌱</span>
        <span style="font-weight: 600;">Sustainability Score: ${Math.round(analysis.score * 100)}%</span>
      </div>
      ${analysis.factors.length > 0 ? `
        <div style="font-size: 13px; opacity: 0.9;">
          ${analysis.factors.map(factor => `
            <div style="margin: 4px 0; display: flex; align-items: center; gap: 6px;">
              <span style="color: ${factor.startsWith('✓') ? '#4ade80' : '#f87171'}">${factor.startsWith('✓') ? '✓' : '✗'}</span>
              <span>${factor.slice(2)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div style="font-size: 12px; opacity: 0.8; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
        Based on materials, packaging, and manufacturer data
      </div>
    `

    // Update badge color based on score with adjusted thresholds
    badge.style.background = analysis.score > 0.65 ? '#059669' : // Green for >65%
                           analysis.score > 0.35 ? '#ca8a04' : // Yellow for 35-65%
                           '#dc2626' // Red for <35%

    // Add click handler for close button
    const closeBtn = document.getElementById('eco-choice-close')
    if (closeBtn) {
      closeBtn.addEventListener('mouseover', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.3)'
      })
      closeBtn.addEventListener('mouseout', () => {
        closeBtn.style.background = 'rgba(255, 255, 255, 0.2)'
      })
      closeBtn.addEventListener('click', () => {
        badge.style.opacity = '0'
        badge.style.transform = 'translateY(-10px)'
        setTimeout(() => container.remove(), 300)
      })
    }
  }, 1500)

  return {
    productInfo: product,
    sustainabilityScore: analysis.score,
    factors: analysis.factors
  }
} 