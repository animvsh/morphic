import { notFound, redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getChats } from '@/lib/insforge/db-actions'
import { getProject } from '@/lib/insforge/project-actions'

import { ProjectDetailClient } from '@/components/projects/project-detail-client'

export default async function ProjectPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await getCurrentUserId()
  if (!userId) {
    redirect(`/auth/login?next=${encodeURIComponent(`/projects/${id}`)}`)
  }

  const [project, allChats] = await Promise.all([
    getProject(id, userId),
    getChats(userId)
  ])
  if (!project) notFound()
  const linkedChatIds = new Set(project.chats.map(chat => chat.id))

  return (
    <ProjectDetailClient
      project={project}
      availableChats={allChats.filter(chat => !linkedChatIds.has(chat.id))}
    />
  )
}
