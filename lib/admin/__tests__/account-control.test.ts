import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getInsForgeAdminClientMock } = vi.hoisted(() => ({
  getInsForgeAdminClientMock: vi.fn()
}))

vi.mock('@/lib/insforge/admin', () => ({
  getInsForgeAdminClient: getInsForgeAdminClientMock
}))

vi.mock('server-only', () => ({}))

import { accountQuotaResponse } from '@/lib/admin/account-control'

function quotaQuery(rows: Array<{ id: string }>, error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn()
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.gte.mockResolvedValue({ data: rows, error })
  getInsForgeAdminClientMock.mockReturnValue({
    database: { from: vi.fn(() => query) }
  })
  return query
}

describe('accountQuotaResponse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not query the ledger when there is no override', async () => {
    expect(
      await accountQuotaResponse('user-1', 'quick', { status: 'active' })
    ).toBeNull()
    expect(getInsForgeAdminClientMock).not.toHaveBeenCalled()
  })

  it('allows usage below the administrator override', async () => {
    quotaQuery([{ id: 'event-1' }])
    expect(
      await accountQuotaResponse('user-1', 'adaptive', {
        status: 'active',
        adaptiveDailyLimit: 2
      })
    ).toBeNull()
  })

  it('blocks usage at the administrator override', async () => {
    quotaQuery([{ id: 'event-1' }])
    const response = await accountQuotaResponse('user-1', 'quick', {
      status: 'active',
      quickDailyLimit: 1
    })

    expect(response?.status).toBe(429)
    await expect(response?.json()).resolves.toMatchObject({
      code: 'account_quota_exceeded',
      mode: 'quick',
      limit: 1,
      remaining: 0
    })
  })

  it('fails closed when an explicit override cannot be verified', async () => {
    quotaQuery([], new Error('database unavailable'))
    const response = await accountQuotaResponse('user-1', 'quick', {
      status: 'active',
      quickDailyLimit: 1
    })

    expect(response?.status).toBe(503)
    await expect(response?.json()).resolves.toMatchObject({
      code: 'account_quota_unavailable'
    })
  })
})
