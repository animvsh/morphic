import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentUser, maybeSingle } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  maybeSingle: vi.fn()
}))

vi.mock('@/lib/auth/get-current-user', () => ({ getCurrentUser }))
vi.mock('@/lib/insforge/admin', () => ({
  getInsForgeAdminClient: () => ({
    database: {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle })
        })
      })
    }
  })
}))

import { requireBrokAdmin, roleCan } from '../auth'

describe('Brok admin authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_ADMIN_PANEL = 'true'
  })

  it('maps role permissions without privilege escalation', () => {
    expect(roleCan('owner', 'manage_admins')).toBe(true)
    expect(roleCan('admin', 'manage_users')).toBe(true)
    expect(roleCan('admin', 'manage_admins')).toBe(false)
    expect(roleCan('support', 'support')).toBe(true)
    expect(roleCan('support', 'export')).toBe(false)
    expect(roleCan('read_only', 'view')).toBe(true)
    expect(roleCan('read_only', 'support')).toBe(false)
  })

  it('returns 401 for an unauthenticated request', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(requireBrokAdmin()).rejects.toMatchObject({ status: 401 })
  })

  it('returns 403 for an authenticated ordinary user', async () => {
    getCurrentUser.mockResolvedValue({
      id: '4f02f81d-7a46-45af-9a2d-4ef79fefcc22',
      email: 'user@example.test',
      user_metadata: {}
    })
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(requireBrokAdmin()).rejects.toMatchObject({ status: 403 })
  })

  it('enforces the requested permission for an active membership', async () => {
    getCurrentUser.mockResolvedValue({
      id: '4f02f81d-7a46-45af-9a2d-4ef79fefcc22',
      email: 'support@example.test',
      user_metadata: { name: 'Support' }
    })
    maybeSingle.mockResolvedValue({
      data: {
        user_id: '4f02f81d-7a46-45af-9a2d-4ef79fefcc22',
        role: 'support',
        status: 'active'
      },
      error: null
    })
    await expect(requireBrokAdmin('view')).resolves.toMatchObject({
      id: '4f02f81d-7a46-45af-9a2d-4ef79fefcc22'
    })
    await expect(requireBrokAdmin('export')).rejects.toMatchObject({
      status: 403
    })
  })
})
