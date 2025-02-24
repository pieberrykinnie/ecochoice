import Image from 'next/image'
import TestAnalyzer from '@/components/TestAnalyzer'

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">
          EcoChoice Browser Companion
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Make sustainable shopping decisions with AI-powered recommendations
        </p>
        <div className="flex justify-center gap-4">
          <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition">
            Install Extension
          </button>
          <button className="border border-green-600 text-green-600 px-6 py-2 rounded-lg hover:bg-green-50 transition">
            Learn More
          </button>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="p-6 bg-white rounded-xl shadow-sm">
          <h3 className="text-xl font-semibold mb-3">Real-time Analysis</h3>
          <p className="text-gray-600">
            Instantly analyze product pages for environmental impact and sustainability metrics.
          </p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm">
          <h3 className="text-xl font-semibold mb-3">Smart Alternatives</h3>
          <p className="text-gray-600">
            Get AI-powered recommendations for eco-friendly product alternatives.
          </p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm">
          <h3 className="text-xl font-semibold mb-3">Impact Tracking</h3>
          <p className="text-gray-600">
            Monitor your environmental impact and contribution to sustainability goals.
          </p>
        </div>
      </section>

      <section className="mb-16">
        <TestAnalyzer />
      </section>
    </div>
  )
} 