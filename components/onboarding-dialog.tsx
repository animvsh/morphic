'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { IconArrowRight, IconCheck } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'

const steps = [
  {
    mark: '◇',
    eyebrow: 'tiny tour · 1 of 3',
    title: 'hi, i’m brok',
    copy: 'a calmer, much more affordable place to search, think, and figure things out.'
  },
  {
    mark: '◎',
    eyebrow: 'tiny tour · 2 of 3',
    title: 'go wide. or go deep.',
    copy: 'deep search checks the web. reason stays with you and the conversation.'
  },
  {
    mark: '□',
    eyebrow: 'tiny tour · 3 of 3',
    title: 'pick up where you left off',
    copy: 'your sidebar keeps every chat close, so the useful context is still there next time.'
  }
] as const

export function OnboardingDialog({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = steps[step]

  if (disabled) return null

  const finish = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error ?? 'could not finish the tiny tour')
      }
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'try that once more')
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/25 px-5 py-8 backdrop-blur-[10px]"
      data-testid="brok-onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <section className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/70 bg-[#f8f8f6] px-7 pb-7 pt-8 text-black shadow-[0_28px_90px_rgba(0,0,0,0.22)] sm:px-9 sm:pb-9 sm:pt-10">
        <button
          type="button"
          className="absolute right-5 top-5 rounded-full px-3 py-1.5 text-xs lowercase text-black/45 transition-colors hover:bg-black/[0.05] hover:text-black"
          onClick={finish}
          disabled={isSaving}
        >
          skip
        </button>

        <div className="mb-12 flex size-12 items-center justify-center rounded-2xl bg-black text-2xl text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          {current.mark}
        </div>
        <p className="mb-3 text-[11px] font-medium lowercase tracking-[0.16em] text-black/38">
          {current.eyebrow}
        </p>
        <h2
          id="onboarding-title"
          className="text-balance text-[32px] font-semibold leading-[1.04] tracking-[-0.045em]"
        >
          {current.title}
        </h2>
        <p className="mt-4 max-w-[33ch] text-pretty text-[15px] leading-6 text-black/55">
          {current.copy}
        </p>

        <div className="mt-10 flex items-center justify-between gap-5">
          <div className="flex gap-1.5" aria-label={`step ${step + 1} of 3`}>
            {steps.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === step ? 'w-6 bg-black' : 'w-1.5 bg-black/15'
                }`}
              />
            ))}
          </div>
          <Button
            type="button"
            className="h-11 rounded-full bg-black px-5 lowercase text-white shadow-sm hover:bg-black/85"
            onClick={() =>
              step === steps.length - 1 ? finish() : setStep(step + 1)
            }
            disabled={isSaving}
          >
            {step === steps.length - 1 ? (
              <>
                {isSaving ? 'saving...' : 'start asking'}
                <IconCheck className="size-4" />
              </>
            ) : (
              <>
                keep going
                <IconArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
        {error && (
          <p className="mt-4 text-right text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
