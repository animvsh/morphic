import { extractText, getDocumentProxy } from 'unpdf'

const MAX_ATTACHMENT_CONTEXT_CHARS = 60_000
const MINIMAX_VISION_PATH = '/v1/coding_plan/vlm'

export type AttachmentUnderstanding = {
  context: string
  kind: 'image' | 'pdf'
}

function truncateContext(text: string) {
  const normalized = text.replace(/\u0000/g, '').trim()
  if (normalized.length <= MAX_ATTACHMENT_CONTEXT_CHARS) return normalized

  return `${normalized.slice(0, MAX_ATTACHMENT_CONTEXT_CHARS)}\n\n[content truncated at ${MAX_ATTACHMENT_CONTEXT_CHARS.toLocaleString()} characters]`
}

function getMiniMaxVisionConfig() {
  const apiKey =
    process.env.MINIMAX_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY
  const configuredHost =
    process.env.MINIMAX_API_HOST ||
    process.env.OPENAI_COMPATIBLE_API_BASE_URL ||
    'https://api.minimax.io'

  if (!apiKey) {
    throw new Error('MiniMax image understanding is not configured')
  }

  const host = configuredHost.replace(/\/v1\/?$/, '').replace(/\/+$/, '')
  return { apiKey, host }
}

async function understandImage(file: File): Promise<AttachmentUnderstanding> {
  const { apiKey, host } = getMiniMaxVisionConfig()
  const bytes = Buffer.from(await file.arrayBuffer())
  const imageUrl = `data:${file.type};base64,${bytes.toString('base64')}`
  const response = await fetch(`${host}${MINIMAX_VISION_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'MM-API-Source': 'Minimax-MCP'
    },
    body: JSON.stringify({
      prompt:
        'Describe this image precisely for another AI assistant. Transcribe all readable text, identify the important objects, people, layout, charts, labels, and visual relationships, and state uncertainty instead of guessing. Return only the factual image analysis.',
      image_url: imageUrl
    }),
    signal: AbortSignal.timeout(45_000)
  })

  const payload = (await response.json().catch(() => null)) as {
    content?: unknown
    base_resp?: { status_code?: number; status_msg?: string }
  } | null
  const providerError = payload?.base_resp
  if (
    !response.ok ||
    (typeof providerError?.status_code === 'number' &&
      providerError.status_code !== 0)
  ) {
    throw new Error(
      providerError?.status_msg ||
        `MiniMax image understanding failed (${response.status})`
    )
  }

  const content =
    typeof payload?.content === 'string' ? truncateContext(payload.content) : ''
  if (!content) {
    throw new Error('MiniMax returned no image understanding')
  }

  return { kind: 'image', context: content }
}

async function understandPdf(file: File): Promise<AttachmentUnderstanding> {
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  const extracted = truncateContext(text)
  const context = extracted
    ? `PDF pages: ${totalPages}\n\n${extracted}`
    : `PDF pages: ${totalPages}\n\nNo machine-readable text was found in this PDF.`

  return { kind: 'pdf', context }
}

export async function understandAttachment(
  file: File
): Promise<AttachmentUnderstanding> {
  if (file.type === 'application/pdf') return understandPdf(file)
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    return understandImage(file)
  }

  throw new Error(`Unsupported attachment type: ${file.type || 'unknown'}`)
}

export function formatAttachmentContext({
  filename,
  mediaType,
  context
}: {
  filename: string
  mediaType: string
  context: string
}) {
  return `Filename: ${filename}\nMedia type: ${mediaType}\n\n${context}`
}

export function getAttachmentContextKey(objectKey: string) {
  return `${objectKey}.brok-context.txt`
}
