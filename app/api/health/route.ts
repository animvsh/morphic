import { NextResponse } from 'next/server'

import { getInsForgeAdminClient } from '@/lib/insforge/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = performance.now()
  const checks = {
    insforge: false,
    minimax: Boolean(
      process.env.OPENAI_COMPATIBLE_API_KEY &&
        process.env.OPENAI_COMPATIBLE_API_BASE_URL
    )
  }

  try {
    const client = getInsForgeAdminClient()
    const { error } = await client.database
      .from('brok_chats')
      .select('id')
      .limit(1)
    if (error) throw error
    checks.insforge = true
  } catch (error) {
    console.error('InsForge health check failed:', error)
  }

  const ready = checks.insforge && checks.minimax
  return NextResponse.json(
    {
      status: ready ? 'ready' : 'degraded',
      service: 'brok',
      checks,
      latencyMs: Math.round(performance.now() - startedAt)
    },
    { status: ready ? 200 : 503 }
  )
}
