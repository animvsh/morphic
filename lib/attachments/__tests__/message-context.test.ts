import { beforeEach, describe, expect, it, vi } from 'vitest'

const storageMocks = vi.hoisted(() => ({
  downloadObjectText: vi.fn(),
  getUserFileObjectKeyPrefix: vi.fn((userId: string) => `${userId}/`)
}))

vi.mock('@/lib/storage/r2-client', () => storageMocks)

import {
  hydrateAttachmentContexts,
  removeRawFilesFromModelMessages
} from '../message-context'

describe('attachment message context', () => {
  beforeEach(() => {
    storageMocks.downloadObjectText.mockReset()
  })

  it('hydrates an owned file with its prepared sidecar context', async () => {
    storageMocks.downloadObjectText.mockResolvedValue(
      'Filename: chart.png\n\nSales rise.'
    )

    const parts = await hydrateAttachmentContexts(
      [
        {
          type: 'file',
          key: 'user-1/chats/chat-1/chart.png',
          filename: 'chart.png',
          mediaType: 'image/png',
          url: 'https://signed.example/chart.png'
        }
      ],
      'user-1'
    )

    expect(storageMocks.downloadObjectText).toHaveBeenCalledWith(
      'user-1/chats/chat-1/chart.png.brok-context.txt'
    )
    expect(parts).toHaveLength(2)
    expect(parts[1]).toMatchObject({
      type: 'data-attachmentContext',
      data: {
        key: 'user-1/chats/chat-1/chart.png',
        text: 'Filename: chart.png\n\nSales rise.'
      }
    })
  })

  it('rejects a different user object key before reading storage', async () => {
    await expect(
      hydrateAttachmentContexts(
        [
          {
            type: 'file',
            key: 'user-2/chats/chat-1/private.png',
            filename: 'private.png'
          }
        ],
        'user-1'
      )
    ).rejects.toThrow('not allowed')
    expect(storageMocks.downloadObjectText).not.toHaveBeenCalled()
  })

  it('removes raw file payloads while preserving the model context', () => {
    const messages = [
      {
        id: 'message-1',
        role: 'user' as const,
        parts: [
          { type: 'file', url: 'https://signed.example/file' },
          { type: 'data-attachmentContext', data: { text: 'read me' } },
          { type: 'text', text: 'summarize this' }
        ]
      }
    ] as any

    expect(removeRawFilesFromModelMessages(messages)[0].parts).toEqual([
      { type: 'data-attachmentContext', data: { text: 'read me' } },
      { type: 'text', text: 'summarize this' }
    ])
  })
})
