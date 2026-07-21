import { createClient } from '@insforge/sdk'

type Result = { name: string; ok: boolean; detail: string }

const results: Result[] = []

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

async function checkInsForge() {
  const client = createClient({
    baseUrl: requireEnv('INSFORGE_URL'),
    headers: { 'x-api-key': requireEnv('INSFORGE_API_KEY') },
    isServerMode: true
  })
  const id = `brok-smoke-${crypto.randomUUID()}`
  const userId = 'brok-smoke-harness'

  const { error: createError } = await client.database
    .from('brok_chats')
    .insert({ id, user_id: userId, title: 'smoke test', visibility: 'private' })
  if (createError) throw createError

  try {
    const { data, error: readError } = await client.database
      .from('brok_chats')
      .select('id, user_id')
      .eq('id', id)
      .single()
    if (readError) throw readError
    if (data?.id !== id || data?.user_id !== userId) {
      throw new Error('InsForge read-back did not match the inserted row')
    }
    results.push({
      name: 'insforge round trip',
      ok: true,
      detail: 'create → read → delete'
    })
  } finally {
    const { error: deleteError } = await client.database
      .from('brok_chats')
      .delete()
      .eq('id', id)
    if (deleteError) throw deleteError
  }
}

async function checkMiniMax() {
  const baseUrl = requireEnv('OPENAI_COMPATIBLE_API_BASE_URL').replace(
    /\/$/,
    ''
  )
  const model = (process.env.OPENAI_COMPATIBLE_MODELS ?? 'MiniMax-M2.7')
    .split(',')[0]
    .trim()
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('OPENAI_COMPATIBLE_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: brok ready' }],
      max_tokens: 32,
      temperature: 0
    })
  })
  if (!response.ok) {
    throw new Error(`MiniMax returned HTTP ${response.status}`)
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content ?? ''
  if (!content.toLowerCase().includes('brok ready')) {
    throw new Error('MiniMax response did not contain the expected marker')
  }
  results.push({
    name: 'minimax intelligence',
    ok: true,
    detail: `${model} answered correctly`
  })
}

async function checkApp() {
  const baseUrl = process.env.BROK_SMOKE_BASE_URL
  if (!baseUrl) return
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`)
  const payload = (await response.json()) as { status?: string }
  if (!response.ok || payload.status !== 'ready') {
    throw new Error(`brok app health returned ${response.status}`)
  }
  results.push({ name: 'brok app health', ok: true, detail: baseUrl })
}

try {
  await checkInsForge()
  await checkMiniMax()
  await checkApp()
  console.table(results)
  console.log('brok smoke passed')
} catch (error) {
  console.table(results)
  console.error(
    'brok smoke failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
}
