import { writeAdminAudit } from '@/lib/admin/audit'
import { requireBrokAdmin } from '@/lib/admin/auth'
import { listAdminUsers } from '@/lib/admin/data'
import { adminErrorResponse } from '@/lib/admin/http'

function csv(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export async function GET() {
  try {
    const actor = await requireBrokAdmin('export')
    const first = await listAdminUsers({ page: 1, pageSize: 100 })
    const users = [...first.items]
    for (let page = 2; page <= first.pageCount; page += 1) {
      users.push(...(await listAdminUsers({ page, pageSize: 100 })).items)
    }
    const fields = [
      'id',
      'email',
      'name',
      'accountStatus',
      'createdAt',
      'lastActiveAt',
      'chatCount',
      'queryCount',
      'totalTokens',
      'estimatedCostUsd',
      'fileCount',
      'storageBytes',
      'feedbackCount'
    ] as const
    const body = [
      fields.join(','),
      ...users.map(user => fields.map(field => csv(user[field])).join(','))
    ].join('\n')
    await writeAdminAudit({
      actorId: actor.id,
      action: 'users.export.csv',
      targetType: 'users',
      after: { rowCount: users.length }
    })
    return new Response(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="brok-users-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'private, no-store'
      }
    })
  } catch (error) {
    return adminErrorResponse(error)
  }
}
