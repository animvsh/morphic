import { NextResponse } from 'next/server'

import { requireBrokAdmin } from '@/lib/admin/auth'
import { adminErrorResponse } from '@/lib/admin/http'
import { getInsForgeAdminClient } from '@/lib/insforge/admin'

export async function GET() {
  try {
    const actor = await requireBrokAdmin('view')
    const client = getInsForgeAdminClient()
    const result = await client.database
      .from('brok_admin_memberships')
      .select('user_id')
      .eq('user_id', actor.id)
      .limit(1)
    if (result.error) throw result.error
    return NextResponse.json({
      status: 'ready',
      adminPanel: true,
      database: 'ready',
      checkedAt: new Date().toISOString()
    })
  } catch (error) {
    return adminErrorResponse(error)
  }
}
