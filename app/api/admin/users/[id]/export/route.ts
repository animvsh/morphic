import { writeAdminAudit } from '@/lib/admin/audit'
import { requireBrokAdmin } from '@/lib/admin/auth'
import { getAdminUser } from '@/lib/admin/data'
import { adminErrorResponse } from '@/lib/admin/http'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireBrokAdmin('export')
    const { id } = await context.params
    const user = await getAdminUser(id, { includeSensitive: true })
    if (!user) return new Response('Not found', { status: 404 })
    await writeAdminAudit({
      actorId: actor.id,
      action: 'user.export.json',
      targetType: 'user',
      targetId: id
    })
    return new Response(JSON.stringify(user, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="brok-user-${id}.json"`,
        'Cache-Control': 'private, no-store'
      }
    })
  } catch (error) {
    return adminErrorResponse(error)
  }
}
