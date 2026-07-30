'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import * as projects from '@/lib/insforge/project-actions'

function clean(value: string | undefined, max: number) {
  return (value ?? '').trim().slice(0, max)
}

async function requireUser() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('authentication required')
  return userId
}

export async function createProjectAction(input: {
  name: string
  description?: string
  instructions?: string
}) {
  const userId = await requireUser()
  const name = clean(input.name, 80)
  if (!name) return { success: false, error: 'name is required' }

  const project = await projects.createProject(userId, {
    name,
    description: clean(input.description, 280),
    instructions: clean(input.instructions, 4000)
  })
  revalidatePath('/projects')
  return { success: true, project }
}

export async function updateProjectAction(
  projectId: string,
  input: { name: string; description: string; instructions: string }
) {
  const userId = await requireUser()
  const name = clean(input.name, 80)
  if (!name) return { success: false, error: 'name is required' }

  const project = await projects.updateProject(projectId, userId, {
    name,
    description: clean(input.description, 280),
    instructions: clean(input.instructions, 4000)
  })
  if (!project) return { success: false, error: 'project not found' }
  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  return { success: true, project }
}

export async function deleteProjectAction(projectId: string) {
  const userId = await requireUser()
  await projects.deleteProject(projectId, userId)
  revalidatePath('/projects')
  return { success: true }
}

export async function addChatToProjectAction(
  projectId: string,
  chatId: string
) {
  const userId = await requireUser()
  const result = await projects.addChatToProject(projectId, chatId, userId)
  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  return result
}

export async function removeChatFromProjectAction(
  projectId: string,
  chatId: string
) {
  const userId = await requireUser()
  const result = await projects.removeChatFromProject(projectId, chatId, userId)
  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
  return result
}
