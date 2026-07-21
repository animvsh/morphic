import { getInsForgeAdminClient } from '@/lib/insforge/admin'

import 'server-only'

export async function writeAdminAudit(input: {
  actorId: string
  action: string
  targetType: string
  targetId?: string
  before?: unknown
  after?: unknown
  reason?: string
}) {
  const client = getInsForgeAdminClient()
  const { error } = await client.database.from('brok_admin_audit_log').insert([
    {
      actor_user_id: input.actorId,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      before_state: input.before ?? null,
      after_state: input.after ?? null,
      reason: input.reason ?? null
    }
  ])
  if (error) throw error
}
