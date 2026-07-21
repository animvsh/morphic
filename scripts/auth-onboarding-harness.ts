type SessionUser = {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}

export {}

type SessionPayload = {
  authenticated: boolean
  user: SessionUser | null
}

const baseUrl = (
  process.env.BROK_SMOKE_BASE_URL ?? 'http://localhost:3100'
).replace(/\/$/, '')
const email = `brok.qa.${Date.now()}.${crypto.randomUUID().slice(0, 8)}@example.com`
const password = `Brok-${crypto.randomUUID()}!`
const cookies = new Map<string, string>()
let userId: string | null = null

function requireCheck(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message)
}

function collectCookies(response: Response) {
  const values =
    (
      response.headers as Headers & {
        getSetCookie?: () => string[]
      }
    ).getSetCookie?.() ?? []
  for (const value of values) {
    const pair = value.split(';', 1)[0]
    const separator = pair.indexOf('=')
    if (separator > 0) {
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
    }
  }
}

function cookieHeader() {
  return Array.from(cookies, ([name, value]) => `${name}=${value}`).join('; ')
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (cookies.size) headers.set('Cookie', cookieHeader())
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  collectCookies(response)
  return response
}

async function continueWithAccount() {
  const response = await request('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'continue', email, password })
  })
  const payload = (await response.json()) as {
    created?: boolean
    error?: string
  }
  requireCheck(
    response.ok,
    `unified account flow failed (${response.status}): ${payload.error}`
  )
  return payload
}

async function session() {
  const response = await request('/api/auth/session')
  requireCheck(response.ok, `session lookup returned ${response.status}`)
  return (await response.json()) as SessionPayload
}

async function cleanup() {
  const insforgeUrl = process.env.INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY
  if (!insforgeUrl || !apiKey) {
    throw new Error('QA user cleanup needs InsForge admin configuration')
  }
  if (!userId) {
    const lookup = await fetch(
      `${insforgeUrl}/api/auth/users?search=${encodeURIComponent(email)}&limit=5`,
      { headers: { 'x-api-key': apiKey } }
    )
    if (lookup.ok) {
      const payload = (await lookup.json()) as {
        data?: Array<{ id: string; email?: string }>
      }
      userId =
        payload.data?.find(candidate => candidate.email === email)?.id ?? null
    }
  }
  if (!userId) return
  const response = await fetch(`${insforgeUrl}/api/auth/users`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ userIds: [userId] })
  })
  requireCheck(response.ok, `QA user cleanup returned ${response.status}`)
}

try {
  const firstContinue = await continueWithAccount()
  requireCheck(firstContinue.created === true, 'first continue did not create')
  requireCheck(
    Array.from(cookies.keys()).some(name =>
      /^insforge[_-]access[_-]token$/.test(name)
    ) &&
      Array.from(cookies.keys()).some(name =>
        /^insforge[_-]refresh[_-]token$/.test(name)
      ),
    'account flow did not return both InsForge session cookies'
  )
  requireCheck(
    cookies.get('sidebar_state') === 'true',
    'account flow did not open the sidebar'
  )

  const firstSession = await session()
  requireCheck(firstSession.authenticated, 'new account has no live session')
  requireCheck(firstSession.user?.email === email, 'session email mismatch')
  userId = firstSession.user?.id ?? null
  requireCheck(userId, 'session did not expose a user id for cleanup')

  const before = await request('/')
  const beforeHtml = await before.text()
  requireCheck(before.ok, `authenticated homepage returned ${before.status}`)
  requireCheck(
    beforeHtml.includes('data-testid="brok-onboarding"'),
    'first-time onboarding was not rendered'
  )
  requireCheck(
    beforeHtml.includes('data-sidebar="sidebar"'),
    'authenticated sidebar was not rendered'
  )

  const complete = await request('/api/auth/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: true })
  })
  requireCheck(complete.ok, `onboarding completion returned ${complete.status}`)

  const after = await request('/')
  const afterHtml = await after.text()
  requireCheck(after.ok, `post-onboarding homepage returned ${after.status}`)
  requireCheck(
    !afterHtml.includes('data-testid="brok-onboarding"'),
    'completed onboarding was shown again'
  )
  requireCheck(
    afterHtml.includes('data-sidebar="sidebar"') && afterHtml.includes(email),
    'sidebar account state was not rendered after onboarding'
  )

  const signOut = await request('/api/auth/session', { method: 'DELETE' })
  requireCheck(signOut.ok, `sign out returned ${signOut.status}`)
  cookies.clear()
  const signedOut = await session()
  requireCheck(!signedOut.authenticated, 'sign out left an active session')

  const secondContinue = await continueWithAccount()
  requireCheck(
    secondContinue.created === false,
    'returning continue created a duplicate account'
  )
  const history = await request('/api/chats?limit=1')
  requireCheck(history.ok, `authenticated history returned ${history.status}`)

  console.table([
    { check: 'unified first-time account flow', result: 'passed' },
    { check: 'InsForge session cookies', result: 'passed' },
    { check: 'persisted onboarding profile', result: 'passed' },
    { check: 'authenticated sidebar + account', result: 'passed' },
    { check: 'sign out + returning sign in', result: 'passed' },
    { check: 'saved chat history endpoint', result: 'passed' }
  ])
  console.log('brok auth + onboarding harness passed')
} finally {
  await cleanup()
}
