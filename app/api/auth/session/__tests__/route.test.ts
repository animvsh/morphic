import { beforeEach, describe, expect, it, vi } from 'vitest'

const signUp = vi.fn()
const signInWithPassword = vi.fn()
const signOut = vi.fn()

vi.mock('@insforge/sdk/ssr', () => ({
  createAuthActions: vi.fn(() => ({
    signUp,
    signInWithPassword,
    signOut
  }))
}))

vi.mock('@/lib/insforge/auth', () => ({
  getInsForgeAuthConfig: vi.fn(() => ({
    baseUrl: 'https://insforge.example',
    anonKey: 'anon'
  }))
}))

import { NextRequest } from 'next/server'

import { POST } from '../route'

function authRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('POST /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://brok.fyi'
  })

  it('signs an existing user in through the unified continue flow', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null
    })

    const response = await POST(
      authRequest({
        mode: 'continue',
        email: ' AALANG@UCSC.EDU ',
        password: 'good-password'
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      created: false
    })
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'aalang@ucsc.edu',
      password: 'good-password'
    })
    expect(response.headers.get('set-cookie')).toContain('sidebar_state=true')
  })

  it('creates a first-time user through the same continue flow', async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid credentials' }
    })
    signUp.mockResolvedValue({
      data: {
        user: { id: 'user-2' },
        requireEmailVerification: false
      },
      error: null
    })

    const response = await POST(
      authRequest({
        mode: 'continue',
        email: 'new@ucsc.edu',
        password: 'good-password'
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      created: true,
      requiresVerification: false
    })
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@ucsc.edu',
        password: 'good-password',
        name: 'new'
      })
    )
  })

  it('does not turn a wrong password into a second account', async () => {
    signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' }
    })
    signUp.mockResolvedValue({
      data: null,
      error: { message: 'User already exists' }
    })

    const response = await POST(
      authRequest({
        mode: 'continue',
        email: 'aalang@ucsc.edu',
        password: 'wrong-password'
      })
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: "couldn't continue. check your password or reset it."
    })
  })

  it('preserves useful signup validation errors', async () => {
    signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' }
    })
    signUp.mockResolvedValue({
      data: null,
      error: { message: 'Password must be at least 6 characters' }
    })

    const response = await POST(
      authRequest({
        mode: 'continue',
        email: 'new@ucsc.edu',
        password: 'short'
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Password must be at least 6 characters'
    })
  })
})
