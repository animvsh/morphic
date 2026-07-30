'use server'

import { generateId } from '@/lib/db/schema'
import type { Project, ProjectWithChats } from '@/lib/projects/types'

import { getInsForgeAdminClient } from './admin'
import { getChat, getChats } from './db-actions'

type QueryResult<T> = { data: T | null; error: unknown }

type ProjectRow = {
  id: string
  owner_id: string
  name: string
  description: string
  instructions: string
  created_at: string
  updated_at: string
}

type ProjectChatRow = {
  project_id: string
  chat_id: string
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown insforge error'
    }
  }
  return String(error ?? 'unknown insforge error')
}

function unwrap<T>(result: QueryResult<T>, operation: string): T {
  if (result.error) throw new Error(`${operation}: ${message(result.error)}`)
  return result.data as T
}

function mapProject(row: ProjectRow, chatCount = 0): Project {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    chatCount
  }
}

export async function getProjects(userId: string): Promise<Project[]> {
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_projects')
      .select()
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })) as QueryResult<ProjectRow[]>,
    'list projects'
  )

  if (!rows.length) return []

  const links = unwrap(
    (await client.database
      .from('brok_project_chats')
      .select('project_id, chat_id')
      .eq('owner_id', userId)) as QueryResult<ProjectChatRow[]>,
    'count project chats'
  )
  const counts = new Map<string, number>()
  links.forEach(link => {
    counts.set(link.project_id, (counts.get(link.project_id) ?? 0) + 1)
  })

  return rows.map(row => mapProject(row, counts.get(row.id) ?? 0))
}

export async function getProject(
  projectId: string,
  userId: string
): Promise<ProjectWithChats | null> {
  const client = getInsForgeAdminClient()
  const row = unwrap(
    (await client.database
      .from('brok_projects')
      .select()
      .eq('id', projectId)
      .eq('owner_id', userId)
      .maybeSingle()) as QueryResult<ProjectRow | null>,
    'load project'
  )
  if (!row) return null

  const links = unwrap(
    (await client.database
      .from('brok_project_chats')
      .select('project_id, chat_id')
      .eq('project_id', projectId)
      .eq('owner_id', userId)) as QueryResult<ProjectChatRow[]>,
    'load project chats'
  )
  const linkedIds = new Set(links.map(link => link.chat_id))
  const chats = (await getChats(userId)).filter(chat => linkedIds.has(chat.id))

  return {
    ...mapProject(row, chats.length),
    chats
  }
}

export async function createProject(
  userId: string,
  input: { name: string; description?: string; instructions?: string }
): Promise<Project> {
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_projects')
      .insert([
        {
          id: generateId(),
          owner_id: userId,
          name: input.name,
          description: input.description ?? '',
          instructions: input.instructions ?? ''
        }
      ])
      .select()) as QueryResult<ProjectRow[]>,
    'create project'
  )
  return mapProject(rows[0])
}

export async function updateProject(
  projectId: string,
  userId: string,
  input: { name: string; description: string; instructions: string }
): Promise<Project | null> {
  const client = getInsForgeAdminClient()
  const rows = unwrap(
    (await client.database
      .from('brok_projects')
      .update({
        name: input.name,
        description: input.description,
        instructions: input.instructions,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .eq('owner_id', userId)
      .select()) as QueryResult<ProjectRow[]>,
    'update project'
  )
  return rows[0] ? mapProject(rows[0]) : null
}

export async function deleteProject(projectId: string, userId: string) {
  const client = getInsForgeAdminClient()
  const result = await client.database
    .from('brok_projects')
    .delete()
    .eq('id', projectId)
    .eq('owner_id', userId)
  unwrap(result as QueryResult<unknown>, 'delete project')
  return { success: true }
}

export async function addChatToProject(
  projectId: string,
  chatId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const [project, chat] = await Promise.all([
    getProject(projectId, userId),
    getChat(chatId, userId)
  ])
  if (!project) return { success: false, error: 'project not found' }
  if (!chat || chat.userId !== userId) {
    return { success: false, error: 'chat not found' }
  }

  const client = getInsForgeAdminClient()
  const result = await client.database.from('brok_project_chats').upsert(
    [
      {
        project_id: projectId,
        chat_id: chatId,
        owner_id: userId
      }
    ],
    { onConflict: 'project_id,chat_id' }
  )
  unwrap(result as QueryResult<unknown>, 'add chat to project')
  return { success: true }
}

export async function removeChatFromProject(
  projectId: string,
  chatId: string,
  userId: string
) {
  const client = getInsForgeAdminClient()
  const result = await client.database
    .from('brok_project_chats')
    .delete()
    .eq('project_id', projectId)
    .eq('chat_id', chatId)
    .eq('owner_id', userId)
  unwrap(result as QueryResult<unknown>, 'remove chat from project')
  return { success: true }
}
