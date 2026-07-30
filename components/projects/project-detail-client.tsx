'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  IconArrowLeft,
  IconMessageCircle,
  IconPlus,
  IconTrash,
  IconX
} from '@tabler/icons-react'
import { toast } from 'sonner'

import {
  addChatToProjectAction,
  deleteProjectAction,
  removeChatFromProjectAction,
  updateProjectAction
} from '@/lib/actions/projects'
import type { Chat } from '@/lib/db/schema'
import type { ProjectWithChats } from '@/lib/projects/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ProjectDetailClient({
  project,
  availableChats
}: {
  project: ProjectWithChats
  availableChats: Chat[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [instructions, setInstructions] = useState(project.instructions)
  const [chatId, setChatId] = useState(availableChats[0]?.id ?? '')

  const save = () => {
    startTransition(async () => {
      const result = await updateProjectAction(project.id, {
        name,
        description,
        instructions
      })
      if (!result.success) {
        toast.error(result.error ?? 'could not save project')
        return
      }
      toast.success('project saved')
      router.refresh()
    })
  }

  const addChat = () => {
    if (!chatId) return
    startTransition(async () => {
      const result = await addChatToProjectAction(project.id, chatId)
      if (!result.success) {
        toast.error(result.error ?? 'could not add chat')
        return
      }
      toast.success('chat added')
      router.refresh()
    })
  }

  const removeChat = (id: string) => {
    startTransition(async () => {
      await removeChatFromProjectAction(project.id, id)
      toast.success('chat removed')
      router.refresh()
    })
  }

  const removeProject = () => {
    if (!window.confirm('delete this project? your chats will stay safe.'))
      return
    startTransition(async () => {
      await deleteProjectAction(project.id)
      toast.success('project deleted')
      router.push('/projects')
      router.refresh()
    })
  }

  return (
    <div className="h-full w-full overflow-y-auto px-5 pb-16 pt-20 md:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <Link
            href="/projects"
            className="mb-7 inline-flex min-h-11 items-center gap-2 text-sm lowercase text-muted-foreground hover:text-foreground"
          >
            <IconArrowLeft size={17} />
            all projects
          </Link>
          <div className="rounded-[32px] border border-border bg-card/70 p-6 md:p-8">
            <p className="mb-6 text-xs font-medium lowercase tracking-[0.2em] text-primary">
              project context
            </p>
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="detail-name" className="lowercase">
                  name
                </Label>
                <Input
                  id="detail-name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="detail-description" className="lowercase">
                  description
                </Label>
                <Input
                  id="detail-description"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  maxLength={280}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-end justify-between gap-4">
                  <Label htmlFor="detail-instructions" className="lowercase">
                    instructions
                  </Label>
                  <span className="text-[11px] lowercase text-muted-foreground">
                    {instructions.length}/4000
                  </span>
                </div>
                <Textarea
                  id="detail-instructions"
                  value={instructions}
                  onChange={event => setInstructions(event.target.value)}
                  maxLength={4000}
                  rows={10}
                  placeholder="how should brok approach work in this project?"
                />
                <p className="text-xs lowercase leading-5 text-muted-foreground">
                  saved as reusable context for this project. chat-level
                  instruction injection is the next foundation layer.
                </p>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
                <Button
                  variant="ghost"
                  onClick={removeProject}
                  disabled={isPending}
                  className="min-h-11 gap-2 lowercase text-destructive hover:text-destructive"
                >
                  <IconTrash size={17} />
                  delete project
                </Button>
                <Button
                  onClick={save}
                  disabled={isPending || !name.trim()}
                  className="min-h-11 lowercase"
                >
                  {isPending ? 'saving...' : 'save changes'}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-[32px] border border-border bg-card/55 p-5 lg:mt-[72px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium lowercase">project chats</h2>
              <p className="mt-1 text-xs lowercase text-muted-foreground">
                {project.chats.length}{' '}
                {project.chats.length === 1 ? 'conversation' : 'conversations'}
              </p>
            </div>
            <IconMessageCircle size={19} className="text-primary" />
          </div>

          {availableChats.length > 0 && (
            <div className="mt-5 flex gap-2">
              <select
                value={chatId}
                onChange={event => setChatId(event.target.value)}
                aria-label="chat to add"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-xs lowercase outline-none focus:border-primary"
              >
                {availableChats.map(chat => (
                  <option key={chat.id} value={chat.id}>
                    {chat.title}
                  </option>
                ))}
              </select>
              <Button
                size="icon"
                onClick={addChat}
                disabled={isPending || !chatId}
                className="size-11 shrink-0 rounded-xl"
                aria-label="add chat"
              >
                <IconPlus size={17} />
              </Button>
            </div>
          )}

          <div className="mt-5 space-y-2">
            {project.chats.length ? (
              project.chats.map(chat => (
                <div
                  key={chat.id}
                  className="group flex items-center gap-2 rounded-2xl border border-border bg-background/45 p-2"
                >
                  <Link
                    href={`/search/${chat.id}`}
                    className="min-w-0 flex-1 rounded-xl px-2 py-2 text-xs lowercase hover:bg-accent"
                  >
                    <span className="block truncate">{chat.title}</span>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeChat(chat.id)}
                    disabled={isPending}
                    className="size-10 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                    aria-label={`remove ${chat.title} from project`}
                  >
                    <IconX size={15} />
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-xs lowercase leading-5 text-muted-foreground">
                add an existing chat to make this project useful.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
