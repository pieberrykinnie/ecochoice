import React, { useState, useEffect } from 'react'

interface TabInfo {
  url: string
  title: string
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
  // Extract product information
  const productInfo = {
    title: document.querySelector('h1')?.textContent?.trim() || '',
    price: document.querySelector('[data-price]')?.textContent || '',
    description: document.querySelector('[data-description]')?.textContent || '',
  }

  // Remove any existing badges
  const existingBadge = document.getElementById('eco-choice-badge')
  if (existingBadge) {
    existingBadge.remove()
  }

  // Create container for notifications
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
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
  `

  // Add loading spinner
  const spinner = document.createElement('div')
  spinner.style.cssText = `
    width: 16px;
    height: 16px;
    border: 2px solid #ffffff;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
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
  badge.appendChild(document.createTextNode('Analyzing product...'))
  container.appendChild(badge)

  // Animate in
  requestAnimationFrame(() => {
    badge.style.opacity = '1'
    badge.style.transform = 'translateY(0)'
  })

  // Simulate analysis
  setTimeout(() => {
    spinner.remove()
    badge.textContent = '✓ Analysis Complete!'
    badge.style.background = '#059669'
    
    setTimeout(() => {
      badge.style.opacity = '0'
      badge.style.transform = 'translateY(-10px)'
      setTimeout(() => container.remove(), 300)
    }, 2000)
  }, 1500)

  return productInfo
} 