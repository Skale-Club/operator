import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  turbopack: {},
  async redirects() {
    return [
      // Legacy /accounts URLs now point to the canonical /companies route.
      { source: '/accounts', destination: '/companies', permanent: true },
      { source: '/accounts/:path*', destination: '/companies/:path*', permanent: true },
    ]
  },
}

nextConfig.allowedDevOrigins = ['192.168.56.1']

export default withSerwist(nextConfig)
