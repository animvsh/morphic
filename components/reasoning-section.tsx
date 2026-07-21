'use client'

import { DefaultSkeleton } from './default-skeleton'
import ProcessHeader from './process-header'

interface ReasoningContent {
  reasoning: string
  isDone: boolean
}

export interface ReasoningSectionProps {
  content: ReasoningContent
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  showIcon?: boolean
  variant?: 'default' | 'minimal' | 'process' | 'process-sub'
  isSingle?: boolean // Whether this is a single item or part of a group
  isFirst?: boolean
  isLast?: boolean
}

export function ReasoningSection({
  content,
  isFirst = false,
  isLast = false
}: ReasoningSectionProps) {
  if (!content) return <DefaultSkeleton />
  if (content.isDone && !content.reasoning?.trim()) return null

  return (
    <div className="relative">
      {!isFirst && (
        <div className="absolute left-[19.5px] w-px bg-border h-2 top-0" />
      )}
      {!isLast && (
        <div className="absolute left-[19.5px] w-px bg-border h-2 bottom-0" />
      )}
      <ProcessHeader
        label={
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-4 shrink-0 grid place-items-center relative">
              <span className="absolute size-3 rounded-full bg-foreground/10 animate-ping motion-reduce:animate-none" />
              <span className="relative size-1.5 rounded-full bg-foreground/65" />
            </div>
            <span className="truncate block min-w-0 max-w-full">
              {content.isDone ? 'reasoned through it' : 'thinking through it'}
            </span>
          </div>
        }
        isLoading={!content.isDone}
        ariaExpanded={false}
      />
    </div>
  )
}
