import { describe, expect, it } from 'vitest'

import nextConfig from '../next.config.mjs'

describe('Next.js proxy configuration', () => {
  it('allows Server Actions from the canonical Cloudflare origins', () => {
    expect(nextConfig.experimental?.serverActions?.allowedOrigins).toEqual([
      'brok.fyi',
      'www.brok.fyi'
    ])
  })
})
