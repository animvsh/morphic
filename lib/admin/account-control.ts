import { getInsForgeAdminClient } from '@/lib/insforge/admin'

import 'server-only'

import type { AccountStatus } from './types'

export interface AccountControl {
  status: AccountStatus
  suspensionReason?: string
  suspendedUntil?: string
  quickDailyLimit?: number
  adaptiveDailyLimit?: number
}

export async function getAccountControl(
  userId: string
): Promise<AccountControl> {
  try {
    const client = getInsForgeAdminClient()
    const { data, error } = await client.database
      .from('brok_account_controls')
      .select(
        'status, suspension_reason, suspended_until, quick_daily_limit, adaptive_daily_limit'
      )
      .eq('user_id', userId)
      .maybeSingle()

    // Keep the existing application available during a kill-switch rollback or
    // before the additive admin migration is deployed.
    if (error || !data) return { status: 'active' }

    const suspendedUntil = data.suspended_until
      ? String(data.suspended_until)
      : undefined
    const suspensionExpired =
      data.status === 'suspended' &&
      suspendedUntil &&
      new Date(suspendedUntil).getTime() <= Date.now()

    return {
      status: suspensionExpired ? 'active' : (data.status as AccountStatus),
      suspensionReason: data.suspension_reason ?? undefined,
      suspendedUntil,
      quickDailyLimit:
        data.quick_daily_limit == null
          ? undefined
          : Number(data.quick_daily_limit),
      adaptiveDailyLimit:
        data.adaptive_daily_limit == null
          ? undefined
          : Number(data.adaptive_daily_limit)
    }
  } catch (error) {
    console.error('Account control lookup failed:', error)
    return { status: 'active' }
  }
}

export function accountControlResponse(control: AccountControl) {
  if (control.status === 'active') return null

  return new Response(
    JSON.stringify({
      error:
        control.status === 'suspended'
          ? 'This account is temporarily suspended.'
          : 'This account is unavailable.',
      code: `account_${control.status}`,
      reason: control.suspensionReason,
      suspendedUntil: control.suspendedUntil
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

export async function accountQuotaResponse(
  userId: string,
  mode: 'quick' | 'adaptive',
  control: AccountControl
): Promise<Response | null> {
  const limit =
    mode === 'quick' ? control.quickDailyLimit : control.adaptiveDailyLimit
  if (limit == null) return null

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)

  try {
    const client = getInsForgeAdminClient()
    const { data, error } = await client.database
      .from('brok_request_events')
      .select('id')
      .eq('user_id', userId)
      .eq('search_mode', mode)
      .gte('started_at', startOfDay.toISOString())

    if (error) throw error
    const used = data?.length ?? 0
    if (used < limit) return null

    const resetAt = new Date(startOfDay)
    resetAt.setUTCDate(resetAt.getUTCDate() + 1)
    return new Response(
      JSON.stringify({
        error: `Daily limit for ${mode === 'quick' ? 'Quick' : 'Adaptive'} mode reached. Please try again tomorrow.`,
        code: 'account_quota_exceeded',
        mode,
        limit,
        remaining: 0,
        resetAt: resetAt.getTime()
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetAt.getTime())
        }
      }
    )
  } catch (error) {
    // An explicit administrator limit must fail closed. Silently allowing the
    // request would make the control appear active while bypassing it.
    console.error('Account quota lookup failed:', error)
    return new Response(
      JSON.stringify({
        error: 'Account quota could not be verified. Please try again.',
        code: 'account_quota_unavailable'
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
