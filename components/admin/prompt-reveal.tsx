'use client'

import { useState } from 'react'

import { revealSensitiveContent } from '@/lib/admin/actions'

export function PromptReveal({
  eventId,
  action = 'query.reveal',
  targetType = 'query'
}: {
  eventId: string
  action?: 'query.reveal' | 'conversation.reveal'
  targetType?: 'query' | 'conversation'
}) {
  const [revealed, setRevealed] = useState(false)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  if (revealed) {
    return (
      <div className="rounded-xl bg-black/[0.035] p-3 text-sm leading-6 whitespace-pre-wrap">
        {content || <span className="text-black/40">No content recorded</span>}
      </div>
    )
  }
  return (
    <button
      type="button"
      disabled={loading}
      className="flex min-h-16 w-full items-center justify-center rounded-xl border border-dashed border-black/15 bg-black/[0.02] text-xs font-semibold text-black/48 hover:bg-black/[0.04]"
      onClick={async () => {
        setLoading(true)
        try {
          const value = await revealSensitiveContent({
            action,
            targetType,
            targetId: eventId
          })
          setContent(value)
          setRevealed(true)
        } finally {
          setLoading(false)
        }
      }}
    >
      {loading ? 'Recording access…' : 'Reveal sensitive prompt (audited)'}
    </button>
  )
}
