import { beforeEach, describe, expect, it, vi } from 'vitest'

const getCurrentUser = vi.fn()
const setProfile = vi.fn()

vi.mock('@/lib/insforge/auth', () => ({
  createInsForgeServerClient: vi.fn(async () => ({
    auth: { getCurrentUser, setProfile }
  }))
}))

import { POST } from '../route'

function onboardingRequest(body: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/auth/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

describe('POST /api/auth/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://brok.fyi'
  })

  it('persists onboarding in the signed-in InsForge profile', async () => {
    getCurrentUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          profile: { name: 'aalang', plan: 'free' }
        }
      },
      error: null
    })
    setProfile.mockResolvedValue({ data: {}, error: null })

    const response = await POST(onboardingRequest({ completed: true }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(setProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'aalang',
        plan: 'free',
        onboarding_completed: true,
        onboarding_completed_at: expect.any(String)
      })
    )
    expect(response.headers.get('set-cookie')).toContain('sidebar_state=true')
  })

  it('rejects unauthenticated onboarding writes', async () => {
    getCurrentUser.mockResolvedValue({
      data: { user: null },
      error: null
    })

    const response = await POST(onboardingRequest({ completed: true }))

    expect(response.status).toBe(401)
    expect(setProfile).not.toHaveBeenCalled()
  })
})
