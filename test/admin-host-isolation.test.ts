import { NextRequest } from 'next/server'

import { afterEach, describe, expect, it } from 'vitest'

import { middleware } from '@/middleware'

describe('admin hostname isolation', () => {
  afterEach(() => {
    delete process.env.INSFORGE_URL
    delete process.env.NEXT_PUBLIC_INSFORGE_URL
  })

  it('does not expose admin pages on the public Brok hostname', async () => {
    const response = await middleware(
      new NextRequest('https://brok.fyi/admin/users', {
        headers: { 'x-brok-original-host': 'brok.fyi' }
      })
    )
    expect(response.status).toBe(404)
  })

  it('rewrites the admin hostname root to the internal admin application', async () => {
    const response = await middleware(
      new NextRequest('https://admin.brok.fyi/', {
        headers: { 'x-brok-original-host': 'admin.brok.fyi' }
      })
    )
    expect(response.headers.get('x-middleware-rewrite')).toContain('/admin')
  })

  it('leaves the public application root unchanged', async () => {
    const response = await middleware(
      new NextRequest('https://brok.fyi/', {
        headers: { 'x-brok-original-host': 'brok.fyi' }
      })
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })
})
