const baseUrl = (process.env.BROK_SMOKE_BASE_URL || 'https://brok.fyi').replace(
  /\/$/,
  ''
)

export {}

type HealthResponse = {
  status?: string
  service?: string
  checks?: {
    insforge?: boolean
    minimax?: boolean
  }
}

const healthResponse = await fetch(`${baseUrl}/api/health`)
const health = (await healthResponse.json()) as HealthResponse
if (
  !healthResponse.ok ||
  health.status !== 'ready' ||
  health.service !== 'brok' ||
  health.checks?.insforge !== true ||
  health.checks?.minimax !== true
) {
  throw new Error(`unexpected health response: ${JSON.stringify(health)}`)
}

const expectedEdge = new URL(baseUrl).hostname === 'brok.fyi'
if (
  expectedEdge &&
  healthResponse.headers.get('x-brok-edge') !== 'cloudflare'
) {
  throw new Error('brok.fyi did not traverse the Cloudflare edge Worker')
}

const homeResponse = await fetch(`${baseUrl}/`)
const home = await homeResponse.text()
if (
  !homeResponse.ok ||
  !home.includes('brok') ||
  !home.includes('what can i help with?')
) {
  throw new Error(`public homepage failed with HTTP ${homeResponse.status}`)
}

const smokeMessage = {
  id: crypto.randomUUID(),
  role: 'user',
  parts: [{ type: 'text', text: 'reply with exactly: brok edge ready' }]
}

const chatResponse = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: 'searchMode=quick'
  },
  body: JSON.stringify({
    message: smokeMessage,
    messages: [smokeMessage],
    chatId: `cloudflare-smoke-${crypto.randomUUID()}`,
    trigger: 'submit-message',
    isNewChat: true
  })
})
if (!chatResponse.ok || !chatResponse.body) {
  throw new Error(`Morphic stream failed with HTTP ${chatResponse.status}`)
}
const stream = await chatResponse.text()
const streamEvents = stream
  .split(/\r?\n/)
  .filter(line => line.startsWith('data: '))
  .flatMap(line => {
    try {
      return [JSON.parse(line.slice(6)) as { type?: string; delta?: string }]
    } catch {
      return []
    }
  })
const streamedAnswer = streamEvents
  .filter(event => event.type === 'text-delta')
  .map(event => event.delta ?? '')
  .join('')
if (!streamEvents.length || !/brok edge ready/i.test(streamedAnswer)) {
  throw new Error('Cloudflare did not pass the Morphic SSE response through')
}
if (/<\/?think>/i.test(streamedAnswer)) {
  throw new Error('private MiniMax reasoning leaked through the edge')
}

console.log(
  JSON.stringify(
    {
      baseUrl,
      edge: expectedEdge ? 'cloudflare' : 'origin',
      railway: 'ready',
      insforge: 'ready',
      minimax: 'ready',
      morphicStream: 'passed',
      thinkLeakage: 'none'
    },
    null,
    2
  )
)
