import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getInsForgeAdminClient } from '@/lib/insforge/admin'

import 'server-only'

import type {
  AdminActor,
  AdminMembership,
  AdminPermission,
  AdminRole
} from './types'

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  owner: new Set([
    'view',
    'support',
    'manage_users',
    'manage_admins',
    'delete_users',
    'export'
  ]),
  admin: new Set(['view', 'support', 'manage_users', 'export']),
  support: new Set(['view', 'support']),
  read_only: new Set(['view'])
}

export class AdminAuthorizationError extends Error {
  status: 401 | 403 | 503

  constructor(message: string, status: 401 | 403 | 503) {
    super(message)
    this.name = 'AdminAuthorizationError'
    this.status = status
  }
}

export function roleCan(role: AdminRole, permission: AdminPermission) {
  return ROLE_PERMISSIONS[role].has(permission)
}

async function getMembership(userId: string) {
  const client = getInsForgeAdminClient()
  const { data, error } = await client.database
    .from('brok_admin_memberships')
    .select('user_id, role, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data || data.status !== 'active') return null

  return {
    userId: String(data.user_id),
    role: data.role as AdminRole,
    status: data.status
  } satisfies AdminMembership
}

export async function getAdminActor(): Promise<AdminActor | null> {
  if (process.env.ENABLE_ADMIN_PANEL !== 'true') return null

  const user = await getCurrentUser()
  if (!user) return null
  const membership = await getMembership(user.id)
  if (!membership) return null

  return {
    id: user.id,
    email: user.email,
    name:
      user.user_metadata.full_name ??
      user.user_metadata.name ??
      user.email?.split('@')[0] ??
      'Administrator',
    membership
  }
}

export async function requireBrokAdmin(
  permission: AdminPermission = 'view'
): Promise<AdminActor> {
  if (process.env.ENABLE_ADMIN_PANEL !== 'true') {
    throw new AdminAuthorizationError('Admin panel is disabled', 503)
  }

  const user = await getCurrentUser()
  if (!user) throw new AdminAuthorizationError('Admin access required', 401)
  const membership = await getMembership(user.id)
  if (!membership) {
    throw new AdminAuthorizationError('Brok admin membership required', 403)
  }
  const actor: AdminActor = {
    id: user.id,
    email: user.email,
    name:
      user.user_metadata.full_name ??
      user.user_metadata.name ??
      user.email?.split('@')[0] ??
      'Administrator',
    membership
  }
  if (!roleCan(actor.membership.role, permission)) {
    throw new AdminAuthorizationError('Insufficient admin permission', 403)
  }
  return actor
}

export async function requireBrokAdminPage(
  permission: AdminPermission = 'view'
): Promise<AdminActor> {
  try {
    return await requireBrokAdmin(permission)
  } catch (error) {
    if (
      error instanceof AdminAuthorizationError &&
      (error.status === 401 || error.status === 403)
    ) {
      redirect('/admin/login')
    }
    throw error
  }
}
