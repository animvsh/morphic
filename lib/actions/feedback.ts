'use server'

import { LangfuseClient } from '@langfuse/client'

import { getInsForgeAdminClient } from '@/lib/insforge/admin'
import type { UIMessageMetadata } from '@/lib/types/ai'
import { isTracingEnabled } from '@/lib/utils/telemetry'

export async function updateMessageFeedback(
  messageId: string,
  score: number,
  userId: string | null = null
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getInsForgeAdminClient()
    let query = client.database
      .from('brok_messages')
      .select('metadata, brok_chats!inner(user_id)')
      .eq('id', messageId)
    if (userId) query = query.eq('brok_chats.user_id', userId)
    const { data: currentMessage, error: loadError } = await query.maybeSingle()
    if (loadError) throw loadError
    if (!currentMessage) return { success: false, error: 'Message not found' }

    const metadata = (currentMessage.metadata ?? {}) as UIMessageMetadata
    const { error: updateError } = await client.database
      .from('brok_messages')
      .update({ metadata: { ...metadata, feedbackScore: score } })
      .eq('id', messageId)
    if (updateError) throw updateError

    // Send feedback to Langfuse if trace ID exists and tracing is enabled
    const traceId = metadata.traceId
    if (traceId && isTracingEnabled()) {
      const langfuse = new LangfuseClient()
      langfuse.score.create({
        traceId,
        name: 'user-feedback',
        value: score,
        comment: score === 1 ? 'Thumbs up' : 'Thumbs down'
      })
      // Flush before the server action returns so the score is not lost
      await langfuse.score.flush()
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating message feedback:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update feedback'
    }
  }
}

export async function getMessageFeedback(
  messageId: string,
  userId: string | null = null
): Promise<number | null> {
  try {
    const client = getInsForgeAdminClient()
    let query = client.database
      .from('brok_messages')
      .select('metadata, brok_chats!inner(user_id)')
      .eq('id', messageId)
    if (userId) query = query.eq('brok_chats.user_id', userId)
    const { data: message, error } = await query.maybeSingle()
    if (error) throw error
    if (!message) return null
    return (message.metadata as UIMessageMetadata)?.feedbackScore ?? null
  } catch (error) {
    console.error('Error getting message feedback:', error)
    return null
  }
}
