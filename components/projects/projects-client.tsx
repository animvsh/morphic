'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { IconArrowUpRight, IconFolder, IconPlus } from '@tabler/icons-react'
import { toast } from 'sonner'

import { createProjectAction } from '@/lib/actions/projects'
import type { Project } from '@/lib/projects/types'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ProjectsClient({
  initialProjects
}: {
  initialProjects: Project[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')

  const create = () => {
    startTransition(async () => {
      const result = await createProjectAction({
        name,
        description,
        instructions
      })
      if (!result.success || !result.project) {
        toast.error(result.error ?? 'could not create project')
        return
      }
      setOpen(false)
      setName('')
      setDescription('')
      setInstructions('')
      toast.success('project created')
      router.push(`/projects/${result.project.id}`)
      router.refresh()
    })
  }

  return (
    <div className="h-full w-full overflow-y-auto px-5 pb-16 pt-20 md:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium lowercase tracking-[0.2em] text-primary">
              organized context
            </p>
            <h1 className="text-3xl font-semibold lowercase tracking-[-0.04em] md:text-4xl">
              projects
            </h1>
            <p className="mt-3 max-w-xl text-sm lowercase leading-6 text-muted-foreground">
              group related chats and give each project its own instructions.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="min-h-11 gap-2 rounded-full lowercase">
                <IconPlus size={17} />
                new project
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[28px] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="lowercase">new project</DialogTitle>
                <DialogDescription className="lowercase">
                  keep a body of work, its chats, and its working context
                  together.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="project-name" className="lowercase">
                    name
                  </Label>
                  <Input
                    id="project-name"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    maxLength={80}
                    placeholder="research, launch, class..."
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-description" className="lowercase">
                    short description
                  </Label>
                  <Input
                    id="project-description"
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    maxLength={280}
                    placeholder="what belongs here?"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project-instructions" className="lowercase">
                    project instructions
                  </Label>
                  <Textarea
                    id="project-instructions"
                    value={instructions}
                    onChange={event => setInstructions(event.target.value)}
                    maxLength={4000}
                    rows={5}
                    placeholder="tone, goals, facts, or rules brok should remember..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={create}
                  disabled={isPending || !name.trim()}
                  className="min-h-11 lowercase"
                >
                  {isPending ? 'creating...' : 'create project'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {initialProjects.length ? (
          <div className="grid gap-4 py-8 md:grid-cols-2">
            {initialProjects.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group flex min-h-48 flex-col justify-between rounded-[28px] border border-border bg-card/70 p-6 transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <IconFolder size={20} />
                  </div>
                  <IconArrowUpRight
                    size={19}
                    className="text-muted-foreground transition group-hover:text-primary"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-medium lowercase tracking-[-0.025em]">
                    {project.name}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm lowercase leading-6 text-muted-foreground">
                    {project.description || 'a clean place for connected work.'}
                  </p>
                  <p className="mt-4 text-xs lowercase text-muted-foreground">
                    {project.chatCount}{' '}
                    {project.chatCount === 1 ? 'chat' : 'chats'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-[32px] border border-dashed border-border px-6 py-16 text-center">
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <IconFolder size={22} />
            </div>
            <h2 className="text-lg font-medium lowercase">
              your first project starts empty
            </h2>
            <p className="mt-2 max-w-sm text-sm lowercase leading-6 text-muted-foreground">
              create one, add a few chats, and keep the context you want to
              reuse.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
