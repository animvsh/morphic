'use server'

import { revalidatePath } from 'next/cache'

import { z } from 'zod'

import { getInsForgeAdminClient } from '@/lib/insforge/admin'
import { deleteUserObjects } from '@/lib/storage/r2-client'

import { writeAdminAudit } from './audit'
import { requireBrokAdmin } from './auth'

const uuid = z.string().uuid()
const optionalLimit = z.preprocess(
  value => (value === '' || value == null ? null : Number(value)),
  z.number().int().min(1).max(100000).nullable()
)

export async function setAccountStatus(formData: FormData) {
  const actor = await requireBrokAdmin('manage_users')
  const input = z
    .object({
      userId: uuid,
      status: z.enum(['active', 'suspended']),
      reason: z.string().trim().max(500).optional(),
      suspendedUntil: z.string().trim().optional()
    })
    .parse(Object.fromEntries(formData))

  const client = getInsForgeAdminClient()
  const current = await client.database
    .from('brok_account_controls')
    .select('*')
    .eq('user_id', input.userId)
    .maybeSingle()
  if (current.error) throw current.error

  const next = {
    user_id: input.userId,
    status: input.status,
    suspension_reason:
      input.status === 'suspended'
        ? input.reason || 'Administrative hold'
        : null,
    suspended_until:
      input.status === 'suspended' && input.suspendedUntil
        ? new Date(input.suspendedUntil).toISOString()
        : null,
    updated_by: actor.id
  }
  await writeAdminAudit({
    actorId: actor.id,
    action: input.status === 'suspended' ? 'user.suspend' : 'user.unsuspend',
    targetType: 'user',
    targetId: input.userId,
    before: current.data,
    after: next,
    reason: input.reason
  })
  const write = await client.database
    .from('brok_account_controls')
    .upsert([next], { onConflict: 'user_id' })
  if (write.error) throw write.error
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${input.userId}`)
}

export async function setQuotaOverrides(formData: FormData) {
  const actor = await requireBrokAdmin('manage_users')
  const input = z
    .object({
      userId: uuid,
      quickDailyLimit: optionalLimit,
      adaptiveDailyLimit: optionalLimit,
      reason: z.string().trim().max(500).optional()
    })
    .parse(Object.fromEntries(formData))

  const client = getInsForgeAdminClient()
  const current = await client.database
    .from('brok_account_controls')
    .select('*')
    .eq('user_id', input.userId)
    .maybeSingle()
  if (current.error) throw current.error
  const next = {
    user_id: input.userId,
    status: current.data?.status ?? 'active',
    quick_daily_limit: input.quickDailyLimit,
    adaptive_daily_limit: input.adaptiveDailyLimit,
    updated_by: actor.id
  }
  await writeAdminAudit({
    actorId: actor.id,
    action: 'user.quota.update',
    targetType: 'user',
    targetId: input.userId,
    before: current.data,
    after: next,
    reason: input.reason
  })
  const write = await client.database
    .from('brok_account_controls')
    .upsert([next], { onConflict: 'user_id' })
  if (write.error) throw write.error
  revalidatePath(`/admin/users/${input.userId}`)
}

export async function setAdminMembership(formData: FormData) {
  const actor = await requireBrokAdmin('manage_admins')
  const input = z
    .object({
      userId: uuid,
      role: z.enum(['owner', 'admin', 'support', 'read_only']),
      status: z.enum(['active', 'disabled'])
    })
    .parse(Object.fromEntries(formData))

  const client = getInsForgeAdminClient()
  const current = await client.database
    .from('brok_admin_memberships')
    .select('*')
    .eq('user_id', input.userId)
    .maybeSingle()
  if (current.error) throw current.error
  const next = {
    user_id: input.userId,
    role: input.role,
    status: input.status,
    created_by: current.data?.created_by ?? actor.id
  }
  await writeAdminAudit({
    actorId: actor.id,
    action: 'admin.membership.update',
    targetType: 'admin_membership',
    targetId: input.userId,
    before: current.data,
    after: next
  })
  const write = await client.database
    .from('brok_admin_memberships')
    .upsert([next], { onConflict: 'user_id' })
  if (write.error) throw write.error
  revalidatePath('/admin/administrators')
}

export async function setFeedbackStatus(formData: FormData) {
  const actor = await requireBrokAdmin('support')
  const input = z
    .object({
      feedbackId: z.string().min(1).max(200),
      status: z.enum(['open', 'in_progress', 'resolved', 'dismissed']),
      note: z.string().trim().max(1000).optional()
    })
    .parse(Object.fromEntries(formData))
  const client = getInsForgeAdminClient()
  await writeAdminAudit({
    actorId: actor.id,
    action: 'feedback.status.update',
    targetType: 'feedback',
    targetId: input.feedbackId,
    after: { status: input.status, note: input.note }
  })
  const write = await client.database
    .from('brok_feedback')
    .update({
      status: input.status,
      resolution_note: input.note ?? null,
      assigned_to: actor.id
    })
    .eq('id', input.feedbackId)
  if (write.error) throw write.error
  revalidatePath('/admin/feedback')
}

export async function setWaitlistStatus(formData: FormData) {
  const actor = await requireBrokAdmin('support')
  const input = z
    .object({
      email: z.string().email(),
      status: z.enum(['requested', 'invited', 'active'])
    })
    .parse(Object.fromEntries(formData))
  const client = getInsForgeAdminClient()
  await writeAdminAudit({
    actorId: actor.id,
    action: 'waitlist.status.update',
    targetType: 'waitlist',
    targetId: input.email.toLowerCase(),
    after: { status: input.status }
  })
  const write = await client.database
    .from('brok_waitlist')
    .update({ status: input.status })
    .eq('email', input.email.toLowerCase())
  if (write.error) throw write.error
  revalidatePath('/admin/feedback')
}

export async function deleteUserAsAdmin(formData: FormData) {
  const actor = await requireBrokAdmin('delete_users')
  const input = z
    .object({
      userId: uuid,
      confirmation: z.string(),
      reason: z.string().trim().min(3).max(500)
    })
    .parse(Object.fromEntries(formData))
  if (input.confirmation !== `DELETE ${input.userId}`) {
    throw new Error('Typed confirmation did not match')
  }
  if (input.userId === actor.id) throw new Error('You cannot delete yourself')

  const client = getInsForgeAdminClient()
  const membership = await client.database
    .from('brok_admin_memberships')
    .select('role, status')
    .eq('user_id', input.userId)
    .maybeSingle()
  if (membership.error) throw membership.error
  if (membership.data?.status === 'active') {
    throw new Error('Disable the administrator membership before deletion')
  }

  await writeAdminAudit({
    actorId: actor.id,
    action: 'user.delete',
    targetType: 'user',
    targetId: input.userId,
    reason: input.reason
  })
  const anonymize = await client.database.rpc('brok_admin_anonymize_user', {
    target_user_id: input.userId
  })
  if (anonymize.error) throw anonymize.error

  for (const [table, column] of [
    ['brok_chats', 'user_id'],
    ['brok_notes', 'user_id'],
    ['brok_library_files', 'user_id']
  ] as const) {
    const result = await client.database
      .from(table)
      .delete()
      .eq(column, input.userId)
    if (result.error) throw result.error
  }
  const feedback = await client.database
    .from('brok_feedback')
    .update({ user_id: null })
    .eq('user_id', input.userId)
  if (feedback.error) throw feedback.error
  await deleteUserObjects(input.userId)

  const baseUrl = process.env.INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY
  if (!baseUrl || !apiKey) throw new Error('InsForge admin auth is unavailable')
  const response = await fetch(`${baseUrl}/api/auth/users`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ userIds: [input.userId] })
  })
  if (!response.ok) {
    throw new Error(`InsForge user deletion failed (${response.status})`)
  }
  revalidatePath('/admin/users')
}

export async function revealSensitiveContent(input: {
  action: 'query.reveal' | 'conversation.reveal'
  targetType: 'query' | 'conversation'
  targetId: string
}): Promise<string> {
  const actor = await requireBrokAdmin('view')
  const parsed = z
    .object({
      action: z.enum(['query.reveal', 'conversation.reveal']),
      targetType: z.enum(['query', 'conversation']),
      targetId: z.string().min(1).max(200)
    })
    .parse(input)
  const client = getInsForgeAdminClient()
  let content = ''
  if (parsed.targetType === 'query') {
    const result = await client.database
      .from('brok_request_events')
      .select('query_text')
      .eq('id', parsed.targetId)
      .maybeSingle()
    if (result.error) throw result.error
    content = String(result.data?.query_text ?? '')
  } else {
    const result = await client.database
      .from('brok_message_parts')
      .select('part_type, payload, part_order')
      .eq('message_id', parsed.targetId)
      .order('part_order', { ascending: true })
    if (result.error) throw result.error
    content = (result.data ?? [])
      .map((part: any) => {
        if (part.payload?.text) return String(part.payload.text)
        if (part.payload?.url) return `[${part.part_type}] ${part.payload.url}`
        return `[${part.part_type}] ${JSON.stringify(part.payload)}`
      })
      .join('\n\n')
  }
  await writeAdminAudit({
    actorId: actor.id,
    action: parsed.action,
    targetType: parsed.targetType,
    targetId: parsed.targetId
  })
  return content
}
