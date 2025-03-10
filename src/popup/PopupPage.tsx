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
  detectedType: string | null
}

interface AnalysisResult {
  productInfo: AmazonProduct
  sustainabilityScore: number
  factors: string[]
  detectedType: string | null
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
    let factors: string[] = []
    let detectedType: string | null = null
    
    type CategoryName = 'materials' | 'energy' | 'packaging' | 'manufacturing' | 'durability'
    type CategoryScores = Record<CategoryName, number>
    
    // Initialize category scores
    let categoryScores: CategoryScores = {
      materials: 0,
      energy: 0,
      packaging: 0,
      manufacturing: 0,
      durability: 0
    }

    // Analyze text content first
    const allText = [
      product.title,
      product.description,
      ...product.features,
      product.materials,
      product.manufacturer
    ].join(' ').toLowerCase()

    // More specific product type detection with priority order
    const productTypes = {
      digital_product: {
        keywords: ['kindle edition', 'ebook', 'digital book', 'kindle book', 'digital download', 'digital product'],
        score_adjustments: {
          materials: 0.8,   // Maximum bonus for no physical materials
          energy: 0.4,     // Good bonus for minimal energy use
          packaging: 0.8,  // Maximum bonus for no packaging
          durability: 0.6  // High bonus for digital durability
        },
        factors: {
          positive: [
            'Digital format eliminates physical waste',
            'No physical materials or packaging needed',
            'Infinitely reproducible without waste',
            'Zero shipping environmental impact'
          ],
          negative: []
        }
      },
      coffee_product: {
        keywords: ['coffee', 'espresso', 'roasted', 'arabica', 'robusta', 'ground coffee'],
        score_adjustments: {
          materials: 0.3,    // Bonus for natural materials
          energy: 0.1,      // Small bonus for minimal processing
          packaging: -0.2    // Penalty for typical packaging
        },
        factors: {
          positive: [
            'Natural and biodegradable materials',
            'Minimal processing required'
          ],
          negative: [
            'Requires protective packaging',
            'Transportation environmental impact'
          ]
        }
      },
      trophy: {
        keywords: ['trophy', 'award', 'medallion', 'plaque'],
        score_adjustments: {
          materials: -0.2,   // Penalty for mixed materials
          durability: 0.3,   // Bonus for long-lasting
          manufacturing: -0.1 // Small penalty for manufacturing
        },
        factors: {
          positive: [
            'Long-lasting durable product',
            'Reusable design'
          ],
          negative: [
            'Mixed material construction',
            'Contains non-biodegradable elements'
          ]
        }
      },
      artificial_plant: {
        keywords: ['artificial plant', 'faux plant', 'fake tree', 'artificial tree', 'silk plant'],
        score_adjustments: {
          materials: -0.3,   // Penalty for synthetic materials
          energy: 0.3,      // Bonus for no maintenance
          durability: 0.4    // Major bonus for longevity
        },
        factors: {
          positive: [
            'No water consumption needed',
            'No pesticides required',
            'Long-lasting alternative to live plants'
          ],
          negative: [
            'Made from synthetic materials',
            'Non-biodegradable components'
          ]
        }
      },
      electronic: {
        keywords: ['laptop', 'computer', 'processor', 'gaming laptop', 'alienware'],
        score_adjustments: {
          materials: -0.4,   // Major penalty for e-waste
          energy: -0.5,     // Major penalty for energy use
          durability: -0.2   // Penalty for obsolescence
        },
        factors: {
          positive: [],
          negative: [
            'Contains hazardous electronic components',
            'High ongoing energy consumption',
            'Electronic waste concerns',
            'Limited upgrade potential'
          ]
        }
      },
      heating_cooling: {
        keywords: ['heater', 'air conditioner', 'thermostat', 'hvac', 'heating', 'cooling'],
        score_adjustments: {
          energy: -0.6,     // Severe penalty for energy use
          materials: -0.2,   // Penalty for components
          durability: -0.2   // Penalty for maintenance needs
        },
        factors: {
          positive: [],
          negative: [
            'Very high energy consumption',
            'Contains electronic components',
            'Regular maintenance required',
            'Limited product lifespan'
          ]
        }
      }
    }

    // Detect product type with more specific matching
    for (const [type, config] of Object.entries(productTypes)) {
      if (config.keywords.some(keyword => 
        allText.includes(keyword) || 
        product.title.toLowerCase().includes(keyword)
      )) {
        detectedType = type
        break
      }
    }

    // Apply product-specific adjustments
    if (detectedType) {
      const typeConfig = productTypes[detectedType as keyof typeof productTypes]
      Object.entries(typeConfig.score_adjustments).forEach(([category, adjustment]) => {
        categoryScores[category as CategoryName] = adjustment
      })
      factors = [
        ...typeConfig.factors.positive.map(f => `✓ ${f}`),
        ...typeConfig.factors.negative.map(f => `✗ ${f}`)
      ]
    }

    // Enhanced sustainability indicators
    const sustainabilityIndicators = {
      materials: {
        positive: [
          'organic', 'recycled', 'natural fiber', 'biodegradable',
          'sustainable materials', 'eco-friendly materials'
        ],
        negative: [
          'plastic', 'synthetic', 'non-recyclable', 'toxic'
        ]
      },
      energy: {
        positive: [
          'energy efficient', 'low power', 'energy star'
        ],
        negative: [
          'high power', 'energy intensive'
        ]
      },
      packaging: {
        positive: [
          'minimal packaging', 'recyclable packaging', 'plastic-free'
        ],
        negative: [
          'excessive packaging', 'plastic packaging'
        ]
      }
    }

    // Add additional factors based on indicators
    if (!detectedType || factors.length < 3) {
      Object.entries(sustainabilityIndicators).forEach(([category, keywords]) => {
        keywords.positive.forEach(keyword => {
          if (allText.includes(keyword) && !factors.some(f => f.includes(keyword))) {
            factors.push(`✓ Uses ${keyword}`)
            categoryScores[category as CategoryName] += 0.2
          }
        })
        
        keywords.negative.forEach(keyword => {
          if (allText.includes(keyword) && !factors.some(f => f.includes(keyword))) {
            factors.push(`✗ Contains ${keyword}`)
            categoryScores[category as CategoryName] -= 0.3
          }
        })
      })
    }

    // Calculate final score with category weights
    score = (
      categoryScores.materials * 0.30 +
      categoryScores.energy * 0.25 +
      categoryScores.packaging * 0.15 +
      categoryScores.manufacturing * 0.15 +
      categoryScores.durability * 0.15
    ) + 0.5

    // Ensure digital products get appropriate high scores
    if (detectedType === 'digital_product') {
      score = Math.max(score, 0.8) // Minimum 80% for digital products
    }

    // Clamp final score
    score = Math.max(0, Math.min(1, score))

    // Prioritize and clean up factors
    factors = Array.from(new Set(factors))
      .sort((a, b) => {
        if (a.startsWith('✓') && !b.startsWith('✓')) return -1
        if (!a.startsWith('✓') && b.startsWith('✓')) return 1
        return 0
      })
      .slice(0, 4) // Limit to 4 most relevant factors

    return {
      score,
      factors,
      detectedType
    }
  }

  // Extract product data
  const product = extractAmazonProduct()
  const analysis = analyzeSustainability(product)

  // Collect data for ML training
  const trainingData = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    product: {
      title: product.title,
      description: product.description,
      features: product.features,
      materials: product.materials,
      manufacturer: product.manufacturer,
      price: product.price
    },
    analysis: {
      score: analysis.score,
      factors: analysis.factors,
      detectedType: analysis.detectedType
    },
    textFeatures: {
      titleLength: product.title.length,
      descriptionLength: product.description.length,
      featureCount: product.features.length,
      hasMaterials: Boolean(product.materials),
      hasManufacturer: Boolean(product.manufacturer),
      priceValue: parseFloat(product.price.replace(/[^0-9.]/g, '')) || 0
    }
  }

  // Store training data
  chrome.storage.local.get('mlTrainingData', (data) => {
    const existingData = data.mlTrainingData || []
    chrome.storage.local.set({
      mlTrainingData: [...existingData, trainingData].slice(-1000) // Keep last 1000 entries
    })
  })

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
      ${analysis.score < 0.65 ? `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
          <div style="font-weight: 500; margin-bottom: 4px;">More Sustainable Alternatives:</div>
          ${findAlternatives(product, analysis.detectedType)}
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
    factors: analysis.factors,
    detectedType: analysis.detectedType
  }
}

function findAlternatives(product: AmazonProduct, detectedType: string | null): string {
  const searchQueries: Record<string, string[]> = {
    electronic: [
      'energy star certified laptop',
      'refurbished laptop',
      'eco friendly laptop'
    ],
    heating_cooling: [
      'energy efficient heater',
      'smart thermostat',
      'eco mode heater'
    ],
    artificial_plant: [
      'live indoor plant',
      'low maintenance plant',
      'native plant'
    ],
    trophy: [
      'recycled trophy',
      'wooden award',
      'sustainable trophy'
    ],
    coffee_product: [
      'organic fair trade coffee',
      'locally roasted coffee',
      'biodegradable coffee pods'
    ]
  }

  const baseUrl = 'https://www.amazon.com/s?k='
  const queries = detectedType && searchQueries[detectedType] 
    ? searchQueries[detectedType]
    : ['eco friendly', 'sustainable', 'environmentally friendly'].map(q => 
        `${q} ${product.title.split(' ').slice(0, 3).join(' ')}`
      )

  return queries.map(q => 
    `<a href="${baseUrl}${encodeURIComponent(q)}" target="_blank" style="
      color: #4ade80;
      text-decoration: none;
      display: block;
      margin: 4px 0;
      font-size: 13px;
    ">🔍 Find ${q}</a>`
  ).join('')
} 