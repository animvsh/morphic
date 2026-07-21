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
