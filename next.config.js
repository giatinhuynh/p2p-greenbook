const crypto = require('crypto')
const path = require('path')

// Suppress punycode deprecation warning
process.removeAllListeners('warning')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['uploadthing.com', 'utfs.io', 'img.clerk.com', 'subdomain', 'files.stripe.com'],
    unoptimized: process.env.NODE_ENV === 'development',
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  optimizeFonts: true,
  experimental: {
    optimizePackageImports: ['@radix-ui', '@hookform/resolvers', 'lucide-react'],
    scrollRestoration: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config, { dev }) => {
    // Basic cache configuration
    config.cache = {
      type: 'memory',
      maxGenerations: 1,
    }

    return config
  },
}

module.exports = nextConfig 