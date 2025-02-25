'use client'

import React, { useState, useEffect } from 'react'
import { MLMetrics } from '../../src/services/MLMetricsService'
import { Line } from 'react-chartjs-2'

interface TabInfo {
  id?: number;
  url: string;
  title: string;
}

interface Stats {
  analyzedProducts: number
  averageScore: number
  totalCO2Saved: number
}

export default function PopupPage() {
  const [currentTab, setCurrentTab] = useState<TabInfo | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [stats, setStats] = useState<Stats>({
    analyzedProducts: 0,
    averageScore: 0,
    totalCO2Saved: 0
  })
  const [mlMetrics, setMLMetrics] = useState<MLMetrics | null>(null)

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

    // Load ML metrics
    chrome.runtime.sendMessage({ action: 'getMLMetrics' }, (response) => {
      if (response) {
        setMLMetrics(response)
      }
    })
  }, [])

  const handleAnalyzeClick = async () => {
    if (!currentTab) return
    
    setIsAnalyzing(true)
    try {
      chrome.tabs.sendMessage(
        currentTab.id as number,
        { action: 'ANALYZE_PRODUCT' },
        async (response) => {
          if (response?.productInfo) {
            const result = await chrome.runtime.sendMessage({
              action: 'analyzeProduct',
              product: response.productInfo
            })

            // Update stats
            chrome.runtime.sendMessage({
              action: 'UPDATE_STATS',
              score: result.score
            }, (newStats) => {
              setStats(newStats)
            })

            // Update ML metrics
            if (result.metrics) {
              setMLMetrics(result.metrics)
            }
          }
        }
      )
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const renderMLMetrics = () => {
    if (!mlMetrics) return null

    const chartData = {
      labels: mlMetrics.trainingHistory.map(h => 
        new Date(h.timestamp).toLocaleDateString()
      ),
      datasets: [
        {
          label: 'Accuracy',
          data: mlMetrics.trainingHistory.map(h => h.accuracy),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        },
        {
          label: 'Loss',
          data: mlMetrics.trainingHistory.map(h => h.loss),
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1
        }
      ]
    }

    return (
      <div className="mt-6 p-4 bg-white rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold mb-3">ML Model Performance</h2>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-sm text-gray-600">Accuracy</span>
            <p className="font-medium">{(mlMetrics.accuracyScore * 100).toFixed(1)}%</p>
          </div>
          <div>
            <span className="text-sm text-gray-600">Data Points</span>
            <p className="font-medium">{mlMetrics.dataPoints}</p>
          </div>
          <div>
            <span className="text-sm text-gray-600">Total Predictions</span>
            <p className="font-medium">{mlMetrics.totalPredictions}</p>
          </div>
          <div>
            <span className="text-sm text-gray-600">Last Training</span>
            <p className="font-medium">
              {new Date(mlMetrics.lastTrainingDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Training History</h3>
          <div className="h-48">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 1
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    )
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

      {renderMLMetrics()}

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