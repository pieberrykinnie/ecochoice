import { NextResponse } from 'next/server'

interface ProductData {
  name: string
  description: string
  price: number
  url: string
}

export async function POST(request: Request) {
  try {
    const product = await request.json() as ProductData

    // Validate required fields
    if (!product.name || !product.description) {
      return NextResponse.json(
        { success: false, error: 'Missing required product information' },
        { status: 400 }
      )
    }

    // Simple mock analysis with randomization for testing
    const mockScore = {
      overall: 0.7 + Math.random() * 0.3, // Random score between 0.7 and 1.0
      carbonFootprint: 1.5 + Math.random() * 2, // Random footprint between 1.5 and 3.5
      recycledMaterials: 0.6 + Math.random() * 0.4, // Random score between 0.6 and 1.0
      sustainablePackaging: 0.8 + Math.random() * 0.2 // Random score between 0.8 and 1.0
    }

    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 500))

    return NextResponse.json({
      success: true,
      product,
      analysis: mockScore,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 