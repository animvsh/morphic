'use client'

import type { RefObject } from 'react'

import { captureClient } from '@/lib/analytics/posthog-client'
import { cn } from '@/lib/utils'

const STARTERS = [
  {
    label: 'explain something weird',
    prompt: 'explain why we dream like you are telling a curious friend'
  },
  {
    label: 'help me decide',
    prompt:
      'help me make a decision by asking me the three questions that matter'
  },
  {
    label: 'plan a tiny adventure',
    prompt: 'plan a surprisingly fun low-cost afternoon near me'
  }
]

interface ActionButtonsProps {
  onSelectPrompt: (prompt: string) => void
  onCategoryClick: (category: string) => void
  inputRef?: RefObject<HTMLTextAreaElement | null>
  className?: string
}

export function ActionButtons({
  onSelectPrompt,
  className
}: ActionButtonsProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-2',
        className
      )}
      aria-label="try a starter"
    >
      {STARTERS.map(starter => (
        <button
          key={starter.label}
          type="button"
          className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs lowercase text-muted-foreground transition-colors hover:border-primary/45 hover:bg-accent hover:text-foreground"
          onClick={() => {
            captureClient('example_prompt_clicked', {
              category: 'brok-starter',
              prompt: starter.prompt
            })
            onSelectPrompt(starter.prompt)
          }}
        >
          {starter.label}
        </button>
      ))}
    </div>
  )
}
