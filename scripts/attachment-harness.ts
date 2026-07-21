import { createClient } from '@insforge/sdk'
import { readFile } from 'node:fs/promises'

type UploadedAttachment = {
  filename: string
  key: string
  mediaType: string
  understanding: 'image' | 'pdf'
  url: string
}

const baseUrl = (
  process.env.BROK_SMOKE_BASE_URL ?? 'http://localhost:3200'
).replace(/\/$/, '')
const email = `brok.attachments.${Date.now()}.${crypto.randomUUID().slice(0, 8)}@example.com`
const password = `Brok-${crypto.randomUUID()}!`
const cookies = new Map<string, string>()
const uploadedKeys: string[] = []
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
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(90_000)
  })
  collectCookies(response)
  return response
}

async function createAccount() {
  const response = await request('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'continue', email, password })
  })
  const payload = (await response.json()) as { error?: string }
  requireCheck(
    response.ok,
    `attachment account setup failed (${response.status}): ${payload.error}`
  )

  const sessionResponse = await request('/api/auth/session')
  const session = (await sessionResponse.json()) as {
    authenticated?: boolean
    user?: { id?: string; email?: string }
  }
  requireCheck(session.authenticated, 'attachment harness has no session')
  requireCheck(session.user?.email === email, 'attachment session mismatch')
  userId = session.user?.id ?? null
  requireCheck(userId, 'attachment session did not expose a user id')
}

async function upload(file: File, chatId: string) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('chatId', chatId)
  const response = await request('/api/upload', {
    method: 'POST',
    body: formData
  })
  const payload = (await response.json()) as {
    error?: string
    message?: string
    file?: UploadedAttachment
  }
  requireCheck(
    response.ok && payload.file,
    `attachment upload failed (${response.status}): ${payload.message || payload.error}`
  )
  uploadedKeys.push(payload.file.key)
  requireCheck(payload.file.url, 'attachment upload returned no signed URL')
  const signedFetch = await fetch(payload.file.url)
  requireCheck(
    signedFetch.ok,
    `private attachment URL returned ${signedFetch.status}`
  )
  return payload.file
}

function parseAnswer(raw: string) {
  let current = ''
  let final = ''
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data: ')) continue
    try {
      const event = JSON.parse(line.slice(6)) as {
        type?: string
        delta?: string
      }
      if (event.type === 'text-start') current = ''
      if (event.type === 'text-delta') current += event.delta ?? ''
      if (event.type === 'text-end' && current.trim()) {
        final = current.trim()
        current = ''
      }
    } catch {
      // Ignore non-JSON keepalive frames.
    }
  }
  return final || current.trim()
}

async function askAboutAttachment(
  attachment: UploadedAttachment,
  chatId: string,
  prompt: string
) {
  const message = {
    id: crypto.randomUUID(),
    role: 'user',
    parts: [
      {
        type: 'file',
        url: attachment.url,
        filename: attachment.filename,
        mediaType: attachment.mediaType,
        key: attachment.key
      },
      {
        type: 'text',
        text: `${prompt}\n\nUse only the attached content. Do not search the web or fetch a URL.`
      }
    ]
  }
  const response = await request('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-search-mode': 'quick'
    },
    body: JSON.stringify({
      message,
      messages: [message],
      chatId,
      trigger: 'submit-message',
      isNewChat: true
    })
  })
  requireCheck(response.ok, `attachment chat returned ${response.status}`)
  const answer = parseAnswer(await response.text())
  requireCheck(answer.length > 0, 'attachment chat returned an empty answer')
  requireCheck(
    !/could not generate a response/i.test(answer),
    'attachment chat returned the generic generation failure'
  )
  return answer
}

async function imageFixture() {
  const path = process.env.BROK_ATTACHMENT_IMAGE_PATH
  if (path) {
    const source = await readFile(path).catch(() => null)
    requireCheck(source, `image fixture does not exist: ${path}`)
    const mediaType = /\.jpe?g$/i.test(path) ? 'image/jpeg' : 'image/png'
    return new File([Uint8Array.from(source)], 'brok-ui.png', {
      type: mediaType
    })
  }

  const bytes = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nKsAAAAASUVORK5CYII='
    ),
    char => char.charCodeAt(0)
  )
  return new File([bytes], 'red-pixel.png', { type: 'image/png' })
}

async function pdfFixture() {
  const response = await fetch(
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  )
  requireCheck(response.ok, `PDF fixture returned ${response.status}`)
  return new File([await response.arrayBuffer()], 'dummy.pdf', {
    type: 'application/pdf'
  })
}

async function storageConfig() {
  if (
    process.env.INSFORGE_STORAGE_URL &&
    process.env.INSFORGE_STORAGE_API_KEY
  ) {
    return {
      url: process.env.INSFORGE_STORAGE_URL,
      apiKey: process.env.INSFORGE_STORAGE_API_KEY
    }
  }

  try {
    const project = JSON.parse(
      await readFile(
        new URL('../.insforge/project.json', import.meta.url),
        'utf8'
      )
    ) as { oss_host?: string; api_key?: string }
    if (project.oss_host && project.api_key) {
      return { url: project.oss_host, apiKey: project.api_key }
    }
  } catch {
    // The harness can still clean up the auth user when no linked storage
    // project exists, which is useful for deployments that do not test files.
  }

  return null
}

async function cleanup() {
  const storageSettings = await storageConfig()
  if (storageSettings && uploadedKeys.length > 0) {
    const storage = createClient({
      baseUrl: storageSettings.url,
      headers: { 'x-api-key': storageSettings.apiKey },
      isServerMode: true
    }).storage.from(process.env.INSFORGE_STORAGE_BUCKET || 'brok-uploads')
    for (const key of uploadedKeys) {
      await Promise.allSettled([
        storage.remove(key),
        storage.remove(`${key}.brok-context.txt`)
      ])
    }
  }

  const insforgeUrl = process.env.INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY
  if (!userId || !insforgeUrl || !apiKey) return
  const response = await fetch(`${insforgeUrl}/api/auth/users`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ userIds: [userId] })
  })
  requireCheck(response.ok, `attachment QA cleanup returned ${response.status}`)
}

try {
  await createAccount()

  const imageChatId = crypto.randomUUID()
  const image = await upload(await imageFixture(), imageChatId)
  requireCheck(image.understanding === 'image', 'image was not vision-prepared')
  const imageAnswer = await askAboutAttachment(
    image,
    imageChatId,
    'What is the most prominent text or visual element in this image? Be concise.'
  )
  const savedImageChat = await request(`/search/${imageChatId}`)
  const savedImageHtml = await savedImageChat.text()
  requireCheck(savedImageChat.ok, 'saved attachment chat did not load')
  requireCheck(
    savedImageHtml.includes(image.filename),
    'saved attachment chat lost the uploaded image'
  )

  const pdfChatId = crypto.randomUUID()
  const pdf = await upload(await pdfFixture(), pdfChatId)
  requireCheck(pdf.understanding === 'pdf', 'PDF was not text-extracted')
  const pdfAnswer = await askAboutAttachment(
    pdf,
    pdfChatId,
    'What exact phrase appears in this PDF? Be concise.'
  )
  requireCheck(
    /dummy pdf/i.test(pdfAnswer),
    `PDF answer did not use extracted text: ${pdfAnswer.slice(0, 160)}`
  )

  console.table([
    { check: 'private InsForge image upload + signed read', result: 'passed' },
    { check: 'MiniMax MCP image understanding', result: 'passed' },
    { check: 'private InsForge PDF upload + extraction', result: 'passed' },
    { check: 'MiniMax attachment-grounded responses', result: 'passed' },
    { check: 'attachment chat history persistence', result: 'passed' }
  ])
  console.log(`image response: ${imageAnswer.slice(0, 180)}`)
  console.log(`pdf response: ${pdfAnswer.slice(0, 180)}`)
  console.log('brok attachment harness passed')
} finally {
  await cleanup()
}
