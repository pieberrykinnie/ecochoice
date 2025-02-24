/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        path: false,
        crypto: false,
      }
    }
    return config
  },
  // Enable static exports for browser extension only in production
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {})
}

module.exports = nextConfig 