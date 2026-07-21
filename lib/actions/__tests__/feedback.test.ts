import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@langfuse/client')
vi.mock('@/lib/insforge/admin')
vi.mock('@/lib/utils/telemetry')

import { LangfuseClient } from '@langfuse/client'

import { getInsForgeAdminClient } from '@/lib/insforge/admin'
import { isTracingEnabled } from '@/lib/utils/telemetry'

import { getMessageFeedback, updateMessageFeedback } from '../feedback'

function mockClient({
  message,
  loadError,
  updateError
}: {
  message?: { metadata: Record<string, unknown> } | null
  loadError?: unknown
  updateError?: unknown
}) {
  const loadBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: message === undefined ? { metadata: {} } : message,
      error: loadError ?? null
    })
  }
  loadBuilder.select.mockReturnValue(loadBuilder)
  loadBuilder.eq.mockReturnValue(loadBuilder)

  const updateBuilder = {
    update: vi.fn(),
    eq: vi.fn().mockResolvedValue({ data: null, error: updateError ?? null })
  }
  updateBuilder.update.mockReturnValue(updateBuilder)

  const database = {
    from: vi
      .fn()
      .mockReturnValueOnce(loadBuilder)
      .mockReturnValueOnce(updateBuilder)
  }
  vi.mocked(getInsForgeAdminClient).mockReturnValue({ database } as never)
  return { database, loadBuilder, updateBuilder }
}

describe('Feedback Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isTracingEnabled).mockReturnValue(false)
  })

  describe('updateMessageFeedback', () => {
    it('updates message feedback successfully', async () => {
      const { updateBuilder } = mockClient({
        message: { metadata: { traceId: 'test-trace-id' } }
      })

      await expect(updateMessageFeedback('message-1', 1)).resolves.toEqual({
        success: true
      })
      expect(updateBuilder.update).toHaveBeenCalledWith({
        metadata: { traceId: 'test-trace-id', feedbackScore: 1 }
      })
    })

    it('returns an error when the message is missing', async () => {
      mockClient({ message: null })
      await expect(updateMessageFeedback('missing', 1)).resolves.toEqual({
        success: false,
        error: 'Message not found'
      })
    })

    it('handles database errors gracefully', async () => {
      mockClient({ loadError: new Error('Database error') })
      await expect(updateMessageFeedback('message-1', -1)).resolves.toEqual({
        success: false,
        error: 'Database error'
      })
    })

    it('sends feedback to Langfuse when tracing is enabled', async () => {
      vi.mocked(isTracingEnabled).mockReturnValue(true)
      const mockScoreCreate = vi.fn()
      const mockFlush = vi.fn().mockResolvedValue(undefined)
      vi.mocked(LangfuseClient).mockImplementation(function () {
        return {
          score: { create: mockScoreCreate, flush: mockFlush }
        } as never
      } as never)
      mockClient({ message: { metadata: { traceId: 'trace-1' } } })

      await expect(updateMessageFeedback('message-1', 1)).resolves.toEqual({
        success: true
      })
      expect(mockScoreCreate).toHaveBeenCalledWith({
        traceId: 'trace-1',
        name: 'user-feedback',
        value: 1,
        comment: 'Thumbs up'
      })
      expect(mockFlush).toHaveBeenCalled()
    })
  })

  describe('getMessageFeedback', () => {
    it('retrieves the stored score', async () => {
      mockClient({ message: { metadata: { feedbackScore: 1 } } })
      await expect(getMessageFeedback('message-1')).resolves.toBe(1)
    })

    it('returns null when the message is missing', async () => {
      mockClient({ message: null })
      await expect(getMessageFeedback('missing')).resolves.toBeNull()
    })

    it('returns null when no score exists', async () => {
      mockClient({ message: { metadata: {} } })
      await expect(getMessageFeedback('message-1')).resolves.toBeNull()
    })

    it('returns null when the database fails', async () => {
      mockClient({ loadError: new Error('Database error') })
      await expect(getMessageFeedback('message-1')).resolves.toBeNull()
    })
  })
})
