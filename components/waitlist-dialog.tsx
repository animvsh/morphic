'use client'

import { useState, useTransition } from 'react'

import {
  IconArrowRight,
  IconCheck,
  IconMail,
  IconSparkles,
  IconUsersGroup
} from '@tabler/icons-react'

import { joinWaitlist, type WaitlistPlan } from '@/lib/actions/waitlist'
import { cn } from '@/lib/utils'

import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './ui/dialog'
import { Input } from './ui/input'

const plans: Array<{
  id: WaitlistPlan
  price: string
  cadence: string
  note: string
}> = [
  {
    id: 'monthly',
    price: '$10',
    cadence: 'a month',
    note: 'easy in, easy out'
  },
  {
    id: 'annual',
    price: '$50',
    cadence: 'a year',
    note: 'five months, basically'
  }
]

const upcoming = [
  { icon: IconSparkles, label: 'shareable pages' },
  { icon: IconUsersGroup, label: 'workspaces, like perplexity' },
  { icon: IconMail, label: 'send + receive email through chat' }
]

export function WaitlistDialog() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState<WaitlistPlan>('annual')
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await joinWaitlist({ email, plan })
      if (!result.success) {
        setError(result.error ?? 'something went sideways')
        return
      }
      setJoined(true)
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      window.setTimeout(() => {
        setJoined(false)
        setError(null)
      }, 180)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-9 rounded-full bg-black px-4 text-xs lowercase text-white shadow-none hover:bg-black/80">
          join the waitlist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] border-black/10 bg-[#f7f6f2] p-5 shadow-2xl sm:max-w-[520px] sm:p-7">
        {joined ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
            <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-black text-white">
              <IconCheck className="size-5" />
            </span>
            <DialogTitle className="text-2xl font-medium lowercase tracking-[-0.04em] text-black">
              you&apos;re on the list.
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-xs lowercase leading-relaxed text-black/55">
              we&apos;ll email you when your{' '}
              {plan === 'annual' ? '$50/year' : '$10/month'} spot is ready.
            </DialogDescription>
            <Button
              type="button"
              variant="ghost"
              className="mt-6 rounded-full lowercase"
              onClick={() => setOpen(false)}
            >
              lovely, thanks
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="pr-8 text-left">
              <div
                className="mb-3 size-9 rounded-xl bg-black"
                aria-hidden="true"
              />
              <DialogTitle className="text-2xl font-medium lowercase tracking-[-0.04em] text-black">
                come build brok with us.
              </DialogTitle>
              <DialogDescription className="max-w-sm lowercase leading-relaxed text-black/55">
                affordable ai, a tiny founding crew, and zero weird pricing
                math.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <fieldset>
                <legend className="mb-2 text-xs lowercase text-black/45">
                  pick your future plan
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {plans.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPlan(option.id)}
                      className={cn(
                        'rounded-2xl border p-4 text-left transition-all',
                        plan === option.id
                          ? 'border-black bg-black text-white'
                          : 'border-black/10 bg-white text-black hover:border-black/25'
                      )}
                    >
                      <span className="block text-xl font-medium tracking-[-0.04em]">
                        {option.price}
                      </span>
                      <span
                        className={cn(
                          'block text-xs lowercase',
                          plan === option.id ? 'text-white/65' : 'text-black/45'
                        )}
                      >
                        {option.cadence} · {option.note}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
                <p className="mb-3 text-xs lowercase text-black/45">
                  here are some features we&apos;re working on
                </p>
                <div className="space-y-2.5">
                  {upcoming.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2.5 text-sm lowercase text-black/75"
                    >
                      <Icon className="size-4 text-black/45" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs lowercase text-black/45">
                  all coming up !!
                </p>
              </div>

              <div>
                <label htmlFor="waitlist-email" className="sr-only">
                  email
                </label>
                <div className="flex gap-2">
                  <Input
                    id="waitlist-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="you@email.com"
                    className="h-12 rounded-2xl border-black/10 bg-white px-4 text-black placeholder:text-black/30 focus-visible:ring-black/20"
                  />
                  <Button
                    type="submit"
                    disabled={isPending}
                    aria-label="join the brok waitlist"
                    className="size-12 shrink-0 rounded-2xl bg-black p-0 text-white hover:bg-black/80"
                  >
                    {isPending ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <IconArrowRight className="size-4" />
                    )}
                  </Button>
                </div>
                {error ? (
                  <p className="mt-2 text-xs lowercase text-red-600">{error}</p>
                ) : null}
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
