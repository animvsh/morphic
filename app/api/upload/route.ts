import { NextRequest, NextResponse } from 'next/server'

import { capture } from '@/lib/analytics/dispatch'
import {
  formatAttachmentContext,
  getAttachmentContextKey,
  understandAttachment
} from '@/lib/attachments/understand-attachment'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as dbActions from '@/lib/insforge/db-actions'
import {
  deleteFileObject,
  getSignedFileUrl,
  isObjectStorageConfigured,
  uploadFileObject,
  uploadTextObject
} from '@/lib/storage/r2-client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isObjectStorageConfigured()) {
      return NextResponse.json(
        {
          error: 'File upload storage is not configured',
          message:
            'Configure private InsForge storage or the legacy S3-compatible storage variables.'
        },
        { status: 400 }
      )
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const chatId = formData.get('chatId') as string
    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 5MB)' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }
    const result = await uploadAttachment(file, userId, chatId)
    if (process.env.ENABLE_AUTH === 'false') {
      return NextResponse.json({ success: true, file: result }, { status: 200 })
    }

    let libraryFile = null
    try {
      const createdFile = await dbActions.createLibraryFile({
        userId,
        // Uploads happen before a new chat row exists. The object key still
        // carries the eventual chat id; keep metadata unattached until then
        // instead of violating the chat foreign key.
        chatId: null,
        filename: result.filename,
        objectKey: result.key,
        mediaType: result.mediaType,
        size: file.size
      })
      libraryFile = {
        ...createdFile,
        key: createdFile.objectKey,
        url: result.url
      }
      await capture({
        event: 'file_saved_to_library',
        distinctId: userId,
        properties: {
          mediaType: result.mediaType,
          source: 'upload',
          size: file.size
        }
      })
    } catch (error) {
      console.error('Library file metadata save failed:', error)
    }

    return NextResponse.json(
      {
        success: true,
        file: libraryFile
          ? { ...result, id: libraryFile.id, size: file.size, libraryFile }
          : { ...result, size: file.size }
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Upload Error:', err)
    const message =
      err instanceof Error
        ? err.message
        : 'The attachment could not be prepared.'
    return NextResponse.json(
      { error: 'Upload failed', message },
      { status: 500 }
    )
  }
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase()
}

async function uploadAttachment(file: File, userId: string, chatId: string) {
  const sanitizedFileName = sanitizeFilename(file.name)
  const safeChatId = chatId?.trim() || 'unassigned'
  const filePath = `${userId}/chats/${safeChatId}/${Date.now()}-${sanitizedFileName}`
  const contextKey = getAttachmentContextKey(filePath)
  const understanding = await understandAttachment(file)
  const context = formatAttachmentContext({
    filename: file.name,
    mediaType: file.type,
    context: understanding.context
  })

  try {
    await uploadFileObject(filePath, file)
    await uploadTextObject(contextKey, context)
    const signedUrl = await getSignedFileUrl(filePath)

    return {
      filename: file.name,
      key: filePath,
      url: signedUrl,
      mediaType: file.type,
      type: 'file',
      understanding: understanding.kind
    }
  } catch (error) {
    await Promise.allSettled([
      deleteFileObject(filePath),
      deleteFileObject(contextKey)
    ])
    const detail = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`Attachment storage failed: ${detail}`)
  }
}
