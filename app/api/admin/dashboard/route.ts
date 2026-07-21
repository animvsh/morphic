import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'

import { requireBrokAdmin } from '@/lib/admin/auth'
import { getDashboardMetrics, getUsageDaily } from '@/lib/admin/data'
import { adminErrorResponse } from '@/lib/admin/http'

export async function GET(request: NextRequest) {
  try {
    await requireBrokAdmin('view')
    const days = z.coerce
      .number()
      .int()
      .min(1)
      .max(365)
      .catch(30)
      .parse(request.nextUrl.searchParams.get('days') ?? 30)
    const [metrics, usage] = await Promise.all([
      getDashboardMetrics(days),
      getUsageDaily(days)
    ])
    return NextResponse.json({ metrics, usage, days })
  } catch (error) {
    return adminErrorResponse(error)
  }
}
