'use server'

import type { UIMessage } from '@/lib/types/ai'
import type { PersistableUIMessage } from '@/lib/types/message-persistence'

import type {
  Chat,
  LibraryFile,
  Message,
  NewLibraryFile,
  NewNote,
  Note
} from '../db/schema'
import { generateId } from '../db/schema'

import { getInsForgeAdminClient } from './admin'

type QueryResult<T> = { data: T | null; error: unknown }

type ChatRow = {
  id: string
  user_id: string
  title: string
  visibility: 'public' | 'private'
  created_at: string
  updated_at: string
}

type MessageRow = {
  id: string
  chat_id: string
  role: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
}

type PartRow = {
  message_id: string
  part_order: number
  payload: UIMessage['parts'][number]
}

type NoteRow = {
  id: string
  user_id: string
  chat_id: string | null
  source_message_id: string | null
  title: string
  content: string
  created_at: string
  updated_at: string
}

type FileRow = {
  id: string
  user_id: string
  chat_id: string | null
  filename: string
  object_key: string
  media_type: string
  size: number | null
  created_at: string
  updated_at: string
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return String(error ?? 'Unknown InsForge error')
}

function unwrap<T>(result: QueryResult<T>, operation: string): T {
  if (result.error) {
    throw new Error(`${operation}: ${errorMessage(result.error)}`)
  }
  return result.data as T
}

function mapChat(row: ChatRow): Chat {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    visibility: row.visibility,
    createdAt: new Date(row.created_at)
  }
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null
  }
}

function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    userId: row.user_id,
    chatId: row.chat_id,
    sourceMessageId: row.source_message_id,
    title: row.title,
    content: row.content,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }
}

function mapFile(row: FileRow): LibraryFile {
  return {
    id: row.id,
    userId: row.user_id,
    chatId: row.chat_id,
    filename: row.filename,
    objectKey: row.object_key,
    mediaType: row.media_type,
    size: row.size,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }
}

function buildMessage(row: MessageRow, parts: PartRow[]): UIMessage {
  return {
    id: row.id,
    role: row.role as UIMessage['role'],
    metadata: row.metadata ?? undefined,
    parts: parts
      .filter(part => part.message_id === row.id)
      .sort((a, b) => a.part_order - b.part_order)
      .map(part => part.payload)
  } as UIMessage
}

export async function createChat({
  id = generateId(),
  title,
  userId,
  visibility = 'private'
}: {
  id?: string
  title: string
  userId: string
  visibility?: 'public' | 'private'
}): Promise<Chat> {
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_chats')
      .insert([{ id, title, user_id: userId, visibility }])
      .select()) as QueryResult<ChatRow[]>,
    'Create chat'
  )
  return mapChat(rows[0])
}

export async function getChat(
  chatId: string,
  userId?: string
): Promise<Chat | null> {
  const client = getInsForgeAdminClient()
  const row = unwrap(
    (await client.database
      .from('brok_chats')
      .select()
      .eq('id', chatId)
      .maybeSingle()) as QueryResult<ChatRow | null>,
    'Load chat'
  )
  if (!row) return null
  if (row.visibility === 'public' || (userId && row.user_id === userId)) {
    return mapChat(row)
  }
  return null
}

export async function upsertMessage(
  message: PersistableUIMessage & { chatId: string },
  _userId?: string
): Promise<Message> {
  const client = getInsForgeAdminClient()
  const existing = unwrap(
    (await client.database
      .from('brok_messages')
      .select('id')
      .eq('id', message.id)
      .maybeSingle()) as QueryResult<{ id: string } | null>,
    'Check message'
  )

  const messageValues = {
    id: message.id,
    chat_id: message.chatId,
    role: message.role,
    metadata: message.metadata ?? null,
    updated_at: existing ? new Date().toISOString() : null
  }

  const rows = existing
    ? unwrap(
        (await client.database
          .from('brok_messages')
          .update(messageValues)
          .eq('id', message.id)
          .select()) as QueryResult<MessageRow[]>,
        'Update message'
      )
    : unwrap(
        (await client.database
          .from('brok_messages')
          .insert([messageValues])
          .select()) as QueryResult<MessageRow[]>,
        'Create message'
      )

  unwrap(
    (await client.database
      .from('brok_message_parts')
      .delete()
      .eq('message_id', message.id)) as QueryResult<unknown>,
    'Replace message parts'
  )

  if (message.parts?.length) {
    unwrap(
      (await client.database.from('brok_message_parts').insert(
        message.parts.map((part, index) => ({
          message_id: message.id,
          part_order: index,
          part_type: part.type,
          payload: part
        }))
      )) as QueryResult<unknown>,
      'Save message parts'
    )
  }

  return mapMessage(rows[0])
}

export async function loadChat(
  chatId: string,
  userId?: string
): Promise<UIMessage[]> {
  const client = getInsForgeAdminClient()
  if (userId && !(await getChat(chatId, userId))) return []

  const rows = unwrap(
    (await client.database
      .from('brok_messages')
      .select()
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })) as QueryResult<MessageRow[]>,
    'Load messages'
  )
  if (!rows.length) return []

  const partRows = unwrap(
    (await client.database
      .from('brok_message_parts')
      .select('message_id, part_order, payload')
      .in(
        'message_id',
        rows.map(row => row.id)
      )
      .order('part_order', { ascending: true })) as QueryResult<PartRow[]>,
    'Load message parts'
  )
  return rows.map(row => buildMessage(row, partRows))
}

export async function loadChatWithMessages(
  chatId: string,
  userId?: string
): Promise<(Chat & { messages: UIMessage[] }) | null> {
  const chat = await getChat(chatId, userId)
  if (!chat) return null
  return { ...chat, messages: await loadChat(chatId, userId) }
}

export async function deleteMessagesAfter(
  chatId: string,
  messageId: string,
  userId?: string
): Promise<{ count: number }> {
  if (userId && !(await getChat(chatId, userId))) return { count: 0 }
  const client = getInsForgeAdminClient()
  const target = unwrap(
    (await client.database
      .from('brok_messages')
      .select('created_at')
      .eq('id', messageId)
      .maybeSingle()) as QueryResult<{ created_at: string } | null>,
    'Find target message'
  )
  if (!target) return { count: 0 }
  const rows = unwrap(
    (await client.database
      .from('brok_messages')
      .select('id')
      .eq('chat_id', chatId)
      .gt('created_at', target.created_at)) as QueryResult<{ id: string }[]>,
    'Find later messages'
  )
  if (rows.length) {
    unwrap(
      (await client.database
        .from('brok_messages')
        .delete()
        .in(
          'id',
          rows.map(row => row.id)
        )) as QueryResult<unknown>,
      'Delete later messages'
    )
  }
  return { count: rows.length }
}

export async function deleteMessagesFromIndex(
  chatId: string,
  messageId: string,
  userId?: string
): Promise<{ count: number }> {
  if (userId && !(await getChat(chatId, userId))) return { count: 0 }
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_messages')
      .select('id')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })) as QueryResult<
      { id: string }[]
    >,
    'Load message index'
  )
  const index = rows.findIndex(row => row.id === messageId)
  if (index < 0) return { count: 0 }
  const ids = rows.slice(index).map(row => row.id)
  unwrap(
    (await client.database
      .from('brok_messages')
      .delete()
      .in('id', ids)) as QueryResult<unknown>,
    'Delete messages from index'
  )
  return { count: ids.length }
}

export async function getChats(userId: string): Promise<Chat[]> {
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_chats')
      .select()
      .eq('user_id', userId)
      .order('created_at', { ascending: false })) as QueryResult<ChatRow[]>,
    'List chats'
  )
  return rows.map(mapChat)
}

export async function getChatsPage(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ chats: Chat[]; nextOffset: number | null }> {
  try {
    const client = getInsForgeAdminClient()
    const rows = unwrap(
      (await client.database
        .from('brok_chats')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)) as QueryResult<ChatRow[]>,
      'List chat page'
    )
    return {
      chats: rows.map(mapChat),
      nextOffset: rows.length === limit ? offset + limit : null
    }
  } catch (error) {
    console.error('Error fetching InsForge chat page:', error)
    return { chats: [], nextOffset: null }
  }
}

export async function deleteChat(chatId: string, userId: string) {
  try {
    const chat = await getChat(chatId, userId)
    if (!chat || chat.userId !== userId) {
      return { success: false, error: 'Unauthorized' }
    }
    const client = getInsForgeAdminClient()
    unwrap(
      (await client.database
        .from('brok_chats')
        .delete()
        .eq('id', chatId)) as QueryResult<unknown>,
      'Delete chat'
    )
    return { success: true }
  } catch (error) {
    console.error('Error deleting InsForge chat:', error)
    return { success: false, error: 'Failed to delete chat' }
  }
}

export async function deleteUserChats(userId: string) {
  try {
    const client = getInsForgeAdminClient()
    unwrap(
      (await client.database
        .from('brok_chats')
        .delete()
        .eq('user_id', userId)) as QueryResult<unknown>,
      'Delete user chats'
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function createNote(
  note: Omit<NewNote, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Note> {
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_notes')
      .insert([
        {
          id: generateId(),
          user_id: note.userId,
          chat_id: note.chatId,
          source_message_id: note.sourceMessageId,
          title: note.title,
          content: note.content
        }
      ])
      .select()) as QueryResult<NoteRow[]>,
    'Create note'
  )
  return mapNote(rows[0])
}

export type NotesPageCursor = { updatedAt: string; id: string }

export async function getNotes(
  userId: string,
  { limit = 25, cursor }: { limit?: number; cursor?: NotesPageCursor } = {}
) {
  const client = getInsForgeAdminClient()
  const pageLimit = Math.max(1, Math.min(limit, 50))
  let query = client.database
    .from('brok_notes')
    .select()
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageLimit + 1)
  if (cursor) query = query.lt('updated_at', cursor.updatedAt)
  const rows = unwrap((await query) as QueryResult<NoteRow[]>, 'List notes')
  const page = rows.slice(0, pageLimit).map(mapNote)
  const last = page[page.length - 1]
  return {
    notes: page,
    nextCursor:
      rows.length > pageLimit && last
        ? { updatedAt: last.updatedAt.toISOString(), id: last.id }
        : null,
    hasMore: rows.length > pageLimit
  }
}

export async function searchNotes(
  userId: string,
  query: string,
  { limit = 20 }: { limit?: number } = {}
): Promise<Note[]> {
  const client = getInsForgeAdminClient()
  let request = client.database
    .from('brok_notes')
    .select()
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)))
  if (query.trim()) request = request.ilike('title', `%${query.trim()}%`)
  return unwrap((await request) as QueryResult<NoteRow[]>, 'Search notes').map(
    mapNote
  )
}

export async function getNote(noteId: string, userId: string) {
  const client = getInsForgeAdminClient()
  const row = unwrap(
    (await client.database
      .from('brok_notes')
      .select()
      .eq('id', noteId)
      .eq('user_id', userId)
      .maybeSingle()) as QueryResult<NoteRow | null>,
    'Load note'
  )
  return row ? mapNote(row) : null
}

export async function deleteNote(noteId: string, userId: string) {
  const note = await getNote(noteId, userId)
  if (!note) return { success: false, error: 'Note not found' }
  const client = getInsForgeAdminClient()
  unwrap(
    (await client.database
      .from('brok_notes')
      .delete()
      .eq('id', noteId)) as QueryResult<unknown>,
    'Delete note'
  )
  return { success: true }
}

export async function deleteUserNotes(userId: string) {
  try {
    const client = getInsForgeAdminClient()
    unwrap(
      (await client.database
        .from('brok_notes')
        .delete()
        .eq('user_id', userId)) as QueryResult<unknown>,
      'Delete user notes'
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function createLibraryFile(
  file: Omit<NewLibraryFile, 'id' | 'createdAt' | 'updatedAt'>
): Promise<LibraryFile> {
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_library_files')
      .insert([
        {
          id: generateId(),
          user_id: file.userId,
          chat_id: file.chatId,
          filename: file.filename,
          object_key: file.objectKey,
          media_type: file.mediaType,
          size: file.size
        }
      ])
      .select()) as QueryResult<FileRow[]>,
    'Create library file'
  )
  return mapFile(rows[0])
}

export type FilesPageCursor = { updatedAt: string; id: string }

export async function getLibraryFiles(
  userId: string,
  { limit = 25, cursor }: { limit?: number; cursor?: FilesPageCursor } = {}
) {
  const client = getInsForgeAdminClient()
  const pageLimit = Math.max(1, Math.min(limit, 50))
  let query = client.database
    .from('brok_library_files')
    .select()
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageLimit + 1)
  if (cursor) query = query.lt('updated_at', cursor.updatedAt)
  const rows = unwrap(
    (await query) as QueryResult<FileRow[]>,
    'List library files'
  )
  const page = rows.slice(0, pageLimit).map(mapFile)
  const last = page[page.length - 1]
  return {
    files: page,
    nextCursor:
      rows.length > pageLimit && last
        ? { updatedAt: last.updatedAt.toISOString(), id: last.id }
        : null,
    hasMore: rows.length > pageLimit
  }
}

export async function searchLibraryFiles(
  userId: string,
  query: string,
  { limit = 20 }: { limit?: number } = {}
) {
  const client = getInsForgeAdminClient()
  let request = client.database
    .from('brok_library_files')
    .select()
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)))
  if (query.trim()) request = request.ilike('filename', `%${query.trim()}%`)
  return unwrap(
    (await request) as QueryResult<FileRow[]>,
    'Search library files'
  ).map(mapFile)
}

export async function deleteLibraryFile(fileId: string, userId: string) {
  const client = getInsForgeAdminClient()
  const row = unwrap(
    (await client.database
      .from('brok_library_files')
      .select('id, object_key')
      .eq('id', fileId)
      .eq('user_id', userId)
      .maybeSingle()) as QueryResult<{
      id: string
      object_key: string
    } | null>,
    'Load library file'
  )
  if (!row) return { success: false, error: 'File not found' }
  unwrap(
    (await client.database
      .from('brok_library_files')
      .delete()
      .eq('id', fileId)) as QueryResult<unknown>,
    'Delete library file'
  )
  return { success: true, objectKey: row.object_key }
}

export async function deleteUserLibraryFiles(userId: string) {
  try {
    const client = getInsForgeAdminClient()
    unwrap(
      (await client.database
        .from('brok_library_files')
        .delete()
        .eq('user_id', userId)) as QueryResult<unknown>,
      'Delete user library files'
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function anonymizeUserFeedback(userId: string) {
  try {
    const client = getInsForgeAdminClient()
    unwrap(
      (await client.database
        .from('brok_feedback')
        .update({ user_id: null })
        .eq('user_id', userId)) as QueryResult<unknown>,
      'Anonymize feedback'
    )
    return { success: true }
  } catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

export async function updateChatVisibility(
  chatId: string,
  userId: string,
  visibility: 'public' | 'private'
) {
  const chat = await getChat(chatId, userId)
  if (!chat || chat.userId !== userId) return null
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_chats')
      .update({ visibility })
      .eq('id', chatId)
      .select()) as QueryResult<ChatRow[]>,
    'Update chat visibility'
  )
  return rows[0] ? mapChat(rows[0]) : null
}

export async function updateChatTitle(
  chatId: string,
  title: string,
  userId?: string
) {
  if (userId && !(await getChat(chatId, userId))) return null
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_chats')
      .update({ title })
      .eq('id', chatId)
      .select()) as QueryResult<ChatRow[]>,
    'Update chat title'
  )
  return rows[0] ? mapChat(rows[0]) : null
}

export async function createChatWithFirstMessageTransaction({
  chatId,
  chatTitle,
  userId,
  message
}: {
  chatId: string
  chatTitle: string
  userId: string
  message: PersistableUIMessage
}): Promise<{ chat: Chat; message: Message }> {
  const chat = await createChat({
    id: chatId,
    title: chatTitle.substring(0, 255),
    userId,
    visibility: 'private'
  })
  try {
    const savedMessage = await upsertMessage({ ...message, chatId }, userId)
    return { chat, message: savedMessage }
  } catch (error) {
    await deleteChat(chatId, userId)
    throw error
  }
}
