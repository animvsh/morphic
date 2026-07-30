import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getProjects } from '@/lib/insforge/project-actions'

import { ProjectsClient } from '@/components/projects/projects-client'

export default async function ProjectsPage() {
  const userId = await getCurrentUserId()
  if (!userId) redirect('/auth/login?next=%2Fprojects')

  const projects = await getProjects(userId)
  return <ProjectsClient initialProjects={projects} />
}
