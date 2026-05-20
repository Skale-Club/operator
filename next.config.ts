import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: [],
}

nextConfig.allowedDevOrigins = ['192.168.56.1']

export default nextConfig
