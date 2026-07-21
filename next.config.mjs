import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: projectRoot,
  turbopack: { root: projectRoot },
  experimental: {
    // brok.fyi is proxied through Cloudflare to Railway. Railway replaces the
    // forwarded host with its internal service domain, so explicitly trust the
    // public origins that are allowed to invoke authenticated Server Actions.
    serverActions: {
      allowedOrigins: ['brok.fyi', 'www.brok.fyi']
    }
  },
  // Reverse proxy for PostHog to reduce tracking-blocker interception.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/relay/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      {
        source: '/relay/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*'
      },
      {
        source: '/relay/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      }
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/vi/**'
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**' // Google user content often follows this pattern
      },
      {
        protocol: 'https',
        hostname: 'imgs.search.brave.com',
        port: '',
        pathname: '/**' // Brave search cached images
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        port: '',
        pathname: '/s2/favicons/**' // Google Favicon API
      }
    ]
  }
}

export default nextConfig

initOpenNextCloudflareForDev()
