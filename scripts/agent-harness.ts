import { describesCurrentBeevrProduct } from './agent-harness-semantics'

type UIMessage = {
  id: string
  role: 'user' | 'assistant'
  parts: Array<{ type: 'text'; text: string }>
}

export {}

type StreamEvent = {
  type?: string
  id?: string
  delta?: string
  toolName?: string
  toolCallId?: string
  output?: {
    state?: string
    query?: string
    results?: SearchResult[]
    identity_resolution?: {
      current_company_candidate?: string
    }
  }
}

type SearchResult = {
  title?: string
  url?: string
  content?: string
}

type TurnResult = {
  answer: string
  events: StreamEvent[]
  searches: string[]
  sourceResults: SearchResult[]
  identityResolutions: Array<{ current_company_candidate?: string }>
  sourceCount: number
}

const baseUrl = (
  process.env.BROK_SMOKE_BASE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '')
let sessionCookie = 'searchMode=quick'

async function authenticateIfConfigured() {
  const email = process.env.BROK_QA_EMAIL
  const password = process.env.BROK_QA_PASSWORD
  if (!email || !password) return false

  const response = await fetch(`${baseUrl}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'sign-in', email, password })
  })
  if (!response.ok) {
    throw new Error(`InsForge sign-in returned HTTP ${response.status}`)
  }

  const setCookies =
    (
      response.headers as Headers & {
        getSetCookie?: () => string[]
      }
    ).getSetCookie?.() ?? []
  const authCookies = setCookies
    .map(value => value.split(';', 1)[0])
    .filter(Boolean)
  if (authCookies.length < 2) {
    throw new Error('InsForge sign-in did not set both session cookies')
  }
  sessionCookie = ['searchMode=quick', ...authCookies].join('; ')
  return true
}

function textMessage(role: UIMessage['role'], text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: 'text', text }]
  }
}

function stripPrivateReasoning(value: string): string {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim()
}

function parseEvents(raw: string): StreamEvent[] {
  return raw
    .split(/\r?\n/)
    .filter(line => line.startsWith('data: '))
    .flatMap(line => {
      try {
        return [JSON.parse(line.slice(6)) as StreamEvent]
      } catch {
        return []
      }
    })
}

function extractFinalAnswer(events: StreamEvent[]): string {
  const completedTextParts: string[] = []
  let active = ''

  for (const event of events) {
    if (event.type === 'text-start') active = ''
    if (event.type === 'text-delta') active += event.delta ?? ''
    if (event.type === 'text-end') {
      const clean = stripPrivateReasoning(active)
      if (clean) completedTextParts.push(clean)
      active = ''
    }
  }

  const trailing = stripPrivateReasoning(active)
  if (trailing) completedTextParts.push(trailing)
  return completedTextParts.at(-1) ?? ''
}

async function runTurn(
  messages: UIMessage[],
  message: UIMessage,
  isNewChat: boolean,
  chatId: string
): Promise<TurnResult> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({
      message,
      messages,
      chatId,
      trigger: 'submit-message',
      isNewChat
    })
  })

  if (!response.ok) {
    throw new Error(`Morphic chat route returned HTTP ${response.status}`)
  }

  const events = parseEvents(await response.text())
  const searchToolCallIds = new Set(
    events
      .filter(event => event.toolName === 'search')
      .flatMap(event => [event.toolCallId, event.id])
      .filter((id): id is string => typeof id === 'string')
  )
  const completeSearches = events.filter(
    event =>
      event.type === 'tool-output-available' &&
      (event.toolName === 'search' ||
        (!!event.toolCallId && searchToolCallIds.has(event.toolCallId))) &&
      event.output?.state === 'complete' &&
      typeof event.output.query === 'string'
  )
  const uniqueSearches = Array.from(
    new Set(completeSearches.map(event => event.output!.query!))
  )
  const sourceCount = Math.max(
    0,
    ...completeSearches.map(event => event.output?.results?.length ?? 0)
  )
  const sourceResults = completeSearches.flatMap(
    event => event.output?.results ?? []
  )
  const identityResolutions = completeSearches.flatMap(event =>
    event.output?.identity_resolution ? [event.output.identity_resolution] : []
  )

  return {
    answer: extractFinalAnswer(events),
    events,
    searches: uniqueSearches,
    sourceResults,
    identityResolutions,
    sourceCount
  }
}

function requireCheck(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message)
}

const firstUser = textMessage(
  'user',
  'who is animesh alang, and what company does he currently run? i have seen capy mentioned, but verify whether that is still current. prefer the newest dated first-party evidence, do not let historical pivots contaminate the current answer, and do not merge same-name people or companies.'
)
const authenticated = await authenticateIfConfigured()
const harnessChatId = `morphic-harness-${crypto.randomUUID()}`
const first = await runTurn([firstUser], firstUser, true, harnessChatId)

requireCheck(first.answer, 'Identity turn produced no final answer')
requireCheck(
  first.events.some(event => event.type === 'reasoning-delta'),
  'MiniMax did not emit a real split reasoning stream'
)
requireCheck(first.searches.length > 0, 'Morphic search tool did not complete')
requireCheck(
  first.searches.some(query => /["“]animesh alang["”]/i.test(query)),
  `Identity search was not exact-name grounded: ${first.searches.join(', ')}`
)
requireCheck(first.sourceCount > 0, 'MiniMax Web MCP returned no sources')
requireCheck(
  first.identityResolutions.some(
    resolution => resolution.current_company_candidate === 'beevr'
  ),
  `Search tool did not produce a deterministic Beevr identity resolution. Resolutions: ${JSON.stringify(first.identityResolutions)}. Sources: ${first.sourceResults
    .map(
      result =>
        `${result.title ?? ''} ${result.url ?? ''} ${result.content ?? ''}`
    )
    .join(' | ')}`
)
requireCheck(
  first.searches.some(
    query =>
      /animesh alang/i.test(query) && /(current|latest|2026)/i.test(query)
  ),
  `Current-company research did not include a recency query: ${first.searches.join(', ')}`
)
const ambiguousCapyQueries = first.searches.filter(
  query =>
    /\bcapy\b/i.test(query) &&
    !/animesh alang|animesh-alang|site:capy\.ad/i.test(query)
)
requireCheck(
  ambiguousCapyQueries.length === 0,
  `Harness allowed ambiguous bare-Capy searches: ${ambiguousCapyQueries.join(', ')}`
)
requireCheck(
  first.sourceResults.some(result => {
    const evidence = `${result.title ?? ''} ${result.url ?? ''} ${result.content ?? ''}`
    return (
      /animesh[- ]alang/i.test(evidence) &&
      /beevr/i.test(evidence) &&
      /(founder|building|company|product)/i.test(evidence)
    )
  }),
  `Current company was not backed by exact-person evidence. Searches: ${first.searches.join(' | ')}. Sources: ${first.sourceResults
    .map(
      result =>
        `${result.title ?? ''} ${result.url ?? ''} ${result.content ?? ''}`
    )
    .join(' | ')}`
)
requireCheck(
  first.sourceResults.some(result => {
    const evidence = `${result.title ?? ''} ${result.url ?? ''} ${result.content ?? ''}`
    return (
      describesCurrentBeevrProduct(evidence) ||
      /beevr.*agent infrastructure layer for businesses/i.test(evidence)
    )
  }),
  'Current Beevr product description was not backed by source evidence'
)
requireCheck(
  !/<\/?think>/i.test(first.answer),
  'Private MiniMax reasoning leaked into the answer'
)
requireCheck(
  !/venox agency|pm fellow at perplexity|unbiased news|same story from every side|kibi\.lol|capy\.app|mechanical engineering|co-founder @ crow|founder of crow|summer 2025/i.test(
    first.answer
  ),
  `Known false identity claim regressed: ${first.answer}`
)
requireCheck(
  /beevr/i.test(first.answer) && describesCurrentBeevrProduct(first.answer),
  `Current company description was missing or incorrect: ${first.answer}`
)
requireCheck(
  /capy/i.test(first.answer) &&
    /(older|old|historical|stale|previous|formerly|no longer|not current|points? to beevr|links? to beevr)/i.test(
      first.answer
    ),
  `Answer did not correct the stale Capy premise: ${first.answer}`
)
requireCheck(
  /\[\d+\]\(#[^)]+\)/.test(first.answer),
  `Grounded answer did not include Morphic inline citations: ${first.answer}`
)

const assistant = textMessage('assistant', first.answer)
const followUp = textMessage(
  'user',
  'in one sentence, what is his current company, what does it do, and what stale company-identity mistake did you avoid?'
)
const second = await runTurn(
  [firstUser, assistant, followUp],
  followUp,
  false,
  harnessChatId
)

requireCheck(
  /beevr/i.test(second.answer) && describesCurrentBeevrProduct(second.answer),
  `Follow-up lost prior-turn context: ${second.answer}`
)
requireCheck(
  !/unbiased news|same story from every side|kibi\.lol|capy\.app/i.test(
    second.answer
  ),
  `False identity claim appeared in follow-up: ${second.answer}`
)

const hackathonUser = textMessage(
  'user',
  'what did animesh alang win at the nvidia hack-a-claw hackathon at uc santa cruz? verify the exact track, project, and teammates, and do not merge adjacent winner groups.'
)
const hackathon = await runTurn(
  [hackathonUser],
  hackathonUser,
  true,
  `morphic-hackathon-harness-${crypto.randomUUID()}`
)

requireCheck(hackathon.answer, 'Hackathon attribution turn produced no answer')
requireCheck(
  hackathon.identityResolutions.length === 0,
  `Hackathon query incorrectly launched company identity expansion: ${JSON.stringify(hackathon.identityResolutions)}`
)
requireCheck(
  /cloud track/i.test(hackathon.answer) && /clawforge/i.test(hackathon.answer),
  `Hackathon result was not attributed to Cloud Track / ClawForge: ${hackathon.answer}`
)
requireCheck(
  !/(?:animesh[^.]{0,160}(?:edge track|factorymind)|(?:edge track|factorymind)[^.]{0,160}animesh)/i.test(
    hackathon.answer
  ),
  `Adjacent FactoryMind winner group was falsely attributed to Animesh: ${hackathon.answer}`
)
requireCheck(
  hackathon.sourceResults.some(result => {
    const evidence = `${result.title ?? ''} ${result.content ?? ''}`
    return (
      /animesh alang/i.test(evidence) &&
      /cloud track winner:\s*clawforge/i.test(evidence) &&
      !/edge track winner:\s*factorymind/i.test(evidence)
    )
  }),
  `Hackathon answer lacked an exact-person winner evidence window: ${hackathon.sourceResults
    .map(result => `${result.title ?? ''} ${result.content ?? ''}`)
    .join(' | ')}`
)

if (authenticated) {
  const historyResponse = await fetch(`${baseUrl}/api/chats?limit=20`, {
    headers: { Cookie: sessionCookie }
  })
  requireCheck(
    historyResponse.ok,
    `Authenticated chat history returned HTTP ${historyResponse.status}`
  )
  const history = (await historyResponse.json()) as {
    chats?: Array<{ id?: string }>
  }
  requireCheck(
    history.chats?.some(chat => chat.id === harnessChatId),
    'Completed authenticated conversation was not persisted to InsForge'
  )
}

console.table([
  {
    check: 'original Morphic streamed route',
    result: 'passed'
  },
  {
    check: 'MiniMax real reasoning events',
    result: 'passed'
  },
  {
    check: 'MiniMax Web MCP search',
    result: `${first.sourceCount} sources`
  },
  {
    check: 'exact-person + current-company safety',
    result: 'passed'
  },
  {
    check: 'multi-turn follow-up context',
    result: 'passed'
  },
  {
    check: 'multi-winner event attribution',
    result: 'passed'
  },
  {
    check: 'InsForge account + history',
    result: authenticated ? 'passed' : 'not requested'
  }
])
console.log('brok Morphic agent harness passed')
