import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pdfMocks = vi.hoisted(() => ({
  extractText: vi.fn(),
  getDocumentProxy: vi.fn()
}))

vi.mock('unpdf', () => pdfMocks)

import { understandAttachment } from '../understand-attachment'

const originalEnv = {
  MINIMAX_API_HOST: process.env.MINIMAX_API_HOST,
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  OPENAI_COMPATIBLE_API_BASE_URL: process.env.OPENAI_COMPATIBLE_API_BASE_URL,
  OPENAI_COMPATIBLE_API_KEY: process.env.OPENAI_COMPATIBLE_API_KEY
}

function makeFile(name: string, type: string, contents: string) {
  const bytes = new TextEncoder().encode(contents)
  return {
    name,
    type,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer
  } as File
}

describe('understandAttachment', () => {
  beforeEach(() => {
    process.env.MINIMAX_API_HOST = 'https://api.minimax.io'
    process.env.MINIMAX_API_KEY = 'test-minimax-key'
    vi.restoreAllMocks()
    pdfMocks.extractText.mockReset()
    pdfMocks.getDocumentProxy.mockReset()
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('uses the official MiniMax MCP vision endpoint for images', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: 'A receipt showing a total of $12.50.',
          base_resp: { status_code: 0 }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    const result = await understandAttachment(
      makeFile('receipt.png', 'image/png', 'image-bytes')
    )

    expect(result).toEqual({
      kind: 'image',
      context: 'A receipt showing a total of $12.50.'
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/coding_plan/vlm',
      expect.objectContaining({ method: 'POST' })
    )
    const request = fetchMock.mock.calls[0][1] as RequestInit
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer test-minimax-key',
      'MM-API-Source': 'Minimax-MCP'
    })
    const body = JSON.parse(request.body as string)
    expect(body.image_url).toMatch(/^data:image\/png;base64,/)
    expect(body.prompt).toContain('Transcribe all readable text')
  })

  it('extracts machine-readable PDF text before MiniMax receives it', async () => {
    pdfMocks.getDocumentProxy.mockResolvedValue({ pdf: true })
    pdfMocks.extractText.mockResolvedValue({
      totalPages: 2,
      text: 'Quarterly revenue grew by 18%.'
    })

    const result = await understandAttachment(
      makeFile('report.pdf', 'application/pdf', 'pdf-bytes')
    )

    expect(result).toEqual({
      kind: 'pdf',
      context: 'PDF pages: 2\n\nQuarterly revenue grew by 18%.'
    })
    expect(pdfMocks.extractText).toHaveBeenCalledWith(
      { pdf: true },
      { mergePages: true }
    )
  })

  it('surfaces MiniMax vision failures instead of pretending an image was read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          base_resp: { status_code: 1004, status_msg: 'invalid token' }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    await expect(
      understandAttachment(makeFile('photo.jpg', 'image/jpeg', 'image-bytes'))
    ).rejects.toThrow('invalid token')
  })
})
