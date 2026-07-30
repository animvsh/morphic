import type { Chat } from '@/lib/db/schema'

export type Project = {
  id: string
  ownerId: string
  name: string
  description: string
  instructions: string
  createdAt: string
  updatedAt: string
  chatCount: number
}

export type ProjectWithChats = Project & {
  chats: Chat[]
}
