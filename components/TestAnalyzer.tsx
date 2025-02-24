'use client'

import React, { useState } from 'react'

interface AnalysisResult {
  success: boolean
  product: {
    name: string
    description: string
    price: number
    url: string
  }
  analysis: {
    overall: number
    carbonFootprint: number
    recycledMaterials: number
    sustainablePackaging: number
  }
  timestamp: string
}

export default function TestAnalyzer() {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const testProduct = {
    name: 'Eco-friendly Water Bottle',
    description: 'Made from recycled materials, this sustainable water bottle helps reduce plastic waste.',
    price: 19.99,
    url: 'https://example.com/eco-bottle'
  }

  const handleTest = async () => {
    try {
      setIsLoading(true)
      setResult(null)
      setError(null)
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testProduct)
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze product')
      }
      
      setResult(data as AnalysisResult)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const renderAnalysisResults = () => {
    if (!result) return null

    return (
      <div className="space-y-6">
        <div className="border-b pb-4">
          <h3 className="font-semibold text-lg mb-2">Product Information</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Name: </span>{result.product.name}</p>
            <p><span className="font-medium">Description: </span>{result.product.description}</p>
            <p><span className="font-medium">Price: </span>${result.product.price.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-lg mb-3">Sustainability Analysis</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Overall Score: </span>
              <div className="flex items-center">
                <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                  <div 
                    className="h-2 bg-green-600 rounded-full"
                    style={{ width: `${Math.round(result.analysis.overall * 100)}%` }}
                  />
                </div>
                <span>{Math.round(result.analysis.overall * 100)}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">Carbon Footprint: </span>
              <span>{result.analysis.carbonFootprint.toFixed(2)} kg CO2e</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">Recycled Materials: </span>
              <span>{Math.round(result.analysis.recycledMaterials * 100)}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">Sustainable Packaging: </span>
              <span>{Math.round(result.analysis.sustainablePackaging * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500 pt-2">
          Analysis performed at: {new Date(result.timestamp).toLocaleString()}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Test Analyzer</h2>
      <button
        onClick={handleTest}
        disabled={isLoading}
        className={`${
          isLoading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-700'
        } text-white px-4 py-2 rounded transition`}
      >
        {isLoading ? 'Analyzing...' : 'Run Test'}
      </button>

      {isLoading && (
        <div className="mt-4 text-gray-600">
          Analyzing product sustainability...
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-600 rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-white rounded shadow-sm">
          {renderAnalysisResults()}
        </div>
      )}
    </div>
  )
} 