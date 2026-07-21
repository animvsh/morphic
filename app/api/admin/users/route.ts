import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { requireBrokAdmin } from '@/lib/admin/auth'
import { listAdminUsers } from '@/lib/admin/data'
import { adminErrorResponse } from '@/lib/admin/http'

export async function GET(request: NextRequest) {
  try {
    await requireBrokAdmin('view')
    const query = z
      .object({
        search: z.string().max(120).catch(''),
        status: z.enum(['all', 'active', 'suspended', 'deleted']).catch('all'),
        page: z.coerce.number().int().min(1).catch(1),
        pageSize: z.coerce.number().int().min(10).max(100).catch(25),
        cursor: z.string().max(500).optional()
      })
      .parse(Object.fromEntries(request.nextUrl.searchParams))
    return NextResponse.json(await listAdminUsers(query))
  } catch (error) {
    return adminErrorResponse(error)
  }
}
