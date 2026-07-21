import type { UIMessage } from 'ai'

import {
  downloadObjectText,
  getUserFileObjectKeyPrefix
} from '@/lib/storage/r2-client'

import { getAttachmentContextKey } from './understand-attachment'

function isOwnedObjectKey(key: string, userId: string) {
  return key.replace(/^\/+/, '').startsWith(getUserFileObjectKeyPrefix(userId))
}

export async function hydrateAttachmentContexts(
  parts: any[] = [],
  userId: string
) {
  const existingKeys = new Set(
    parts
      .filter(part => part?.type === 'data-attachmentContext')
      .map(part => part.data?.key)
      .filter((key): key is string => typeof key === 'string')
  )

  const hydrated = await Promise.all(
    parts.map(async part => {
      if (part?.type !== 'file' || typeof part.key !== 'string') return [part]
      if (existingKeys.has(part.key)) return [part]
      if (!isOwnedObjectKey(part.key, userId)) {
        throw new Error('File object key is not allowed for this user')
      }

      try {
        const context = await downloadObjectText(
          getAttachmentContextKey(part.key)
        )
        if (!context.trim()) {
          throw new Error('The extracted attachment context was empty')
        }
        return [
          part,
          {
            type: 'data-attachmentContext',
            data: {
              key: part.key,
              filename: part.filename,
              mediaType: part.mediaType,
              text: context
            }
          }
        ]
      } catch (error) {
        console.error('Failed to load attachment context:', error)
        throw new Error(
          `Could not read the prepared content for ${part.filename || 'this attachment'}. Please upload it again.`
        )
      }
    })
  )

  return hydrated.flat()
}

export function removeRawFilesFromModelMessages(messages: UIMessage[]) {
  return messages.map(message => ({
    ...message,
    parts: message.parts?.filter(part => part.type !== 'file') ?? []
  }))
}
