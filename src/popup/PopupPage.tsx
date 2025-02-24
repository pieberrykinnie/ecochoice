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

      // Update stats with mock data for now
      const newStats = {
        analyzedProducts: stats.analyzedProducts + 1,
        averageScore: (stats.averageScore * stats.analyzedProducts + 0.85) / (stats.analyzedProducts + 1),
        totalCO2Saved: stats.totalCO2Saved + 2.5
      }
      setStats(newStats)
      chrome.storage.local.set({ stats: newStats })

      // Inject the content script and close the popup
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: analyzeProduct
      })
      
      // Close the popup
      window.close()
      
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
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
function analyzeProduct() {
  // Extract product information based on the current URL
  function extractAmazonProduct(): AmazonProduct {
    const title = document.querySelector('#productTitle')?.textContent?.trim() || ''
    const price = document.querySelector('.a-price .a-offscreen')?.textContent || ''
    const description = document.querySelector('#productDescription p')?.textContent?.trim() || ''
    const features = Array.from(document.querySelectorAll('#feature-bullets li span'))
      .map(el => el.textContent?.trim())
      .filter((text): text is string => text !== undefined && text !== null)
    const specifications = Object.fromEntries(
      Array.from(document.querySelectorAll('#productDetails_techSpec_section_1 tr')).map(row => [
        row.querySelector('th')?.textContent?.trim() || '',
        row.querySelector('td')?.textContent?.trim() || ''
      ])
    )
    const materials = specifications['Material'] || specifications['Materials'] || ''
    const packaging = specifications['Package Dimensions'] || ''
    const weight = specifications['Item Weight'] || ''
    const manufacturer = specifications['Manufacturer'] || ''

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
    
    // Keywords that indicate sustainability
    const sustainableKeywords = {
      positive: [
        'organic', 'recycled', 'sustainable', 'eco-friendly', 'biodegradable',
        'compostable', 'renewable', 'natural', 'bamboo', 'solar', 'energy efficient',
        'water saving', 'fair trade', 'local', 'recyclable'
      ],
      negative: [
        'plastic', 'disposable', 'battery', 'batteries', 'petroleum',
        'non-recyclable', 'toxic', 'chemical', 'synthetic'
      ]
    }

    // Check materials
    const allText = [
      product.title,
      product.description,
      ...product.features,
      product.materials
    ].join(' ').toLowerCase()

    // Count sustainable keywords
    let positiveCount = 0
    sustainableKeywords.positive.forEach(keyword => {
      if (allText.includes(keyword)) {
        positiveCount++
        factors.push(`✓ Contains ${keyword} materials/features`)
      }
    })
    score += (positiveCount * 0.1)

    // Count negative keywords
    let negativeCount = 0
    sustainableKeywords.negative.forEach(keyword => {
      if (allText.includes(keyword)) {
        negativeCount++
        factors.push(`✗ Contains ${keyword} materials/features`)
      }
    })
    score -= (negativeCount * 0.1)

    // Check packaging
    if (product.packaging) {
      if (product.packaging.toLowerCase().includes('minimal') || 
          product.packaging.toLowerCase().includes('recyclable')) {
        score += 0.1
        factors.push('✓ Eco-friendly packaging')
      }
    }

    // Check manufacturer sustainability commitment
    if (product.manufacturer) {
      const manufacturerLower = product.manufacturer.toLowerCase()
      if (manufacturerLower.includes('eco') || 
          manufacturerLower.includes('green') || 
          manufacturerLower.includes('sustainable')) {
        score += 0.1
        factors.push('✓ Sustainable manufacturer')
      }
    }

    // Clamp score between 0 and 1
    score = Math.max(0, Math.min(1, score))

    return {
      score,
      factors: factors.slice(0, 5) // Limit to top 5 factors
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
  `

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

    // Update badge content
    badge.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="font-size: 18px;">🌱</span>
        <span style="font-weight: 600;">Sustainability Score: ${Math.round(analysis.score * 100)}%</span>
      </div>
      ${analysis.factors.length > 0 ? `
        <div style="font-size: 13px; opacity: 0.9;">
          ${analysis.factors.map(factor => `<div style="margin: 2px 0;">${factor}</div>`).join('')}
        </div>
      ` : ''}
      <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
        Based on materials, packaging, and manufacturer data
      </div>
    `

    // Update badge color based on score
    badge.style.background = analysis.score > 0.7 ? '#059669' : 
                           analysis.score > 0.4 ? '#ca8a04' : '#dc2626'

    // Fade out after delay
    setTimeout(() => {
      badge.style.opacity = '0'
      badge.style.transform = 'translateY(-10px)'
      setTimeout(() => container.remove(), 300)
    }, 5000)
  }, 1500)

  return {
    productInfo: product,
    sustainabilityScore: analysis.score,
    factors: analysis.factors
  }
} 