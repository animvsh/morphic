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
import { IconLogo } from './ui/icons'
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
        <Button className="bg-warm h-9 rounded-full px-4 text-xs lowercase text-primary-foreground shadow-sm hover:opacity-90">
          join the waitlist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] border-border bg-card p-5 shadow-2xl sm:max-w-[520px] sm:p-7">
        {joined ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
            <span className="bg-warm mb-5 flex size-12 items-center justify-center rounded-2xl text-primary-foreground">
              <IconCheck className="size-5" />
            </span>
            <DialogTitle className="text-2xl font-medium lowercase tracking-[-0.04em] text-foreground">
              you&apos;re on the list.
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-xs lowercase leading-relaxed text-muted-foreground">
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
              <IconLogo className="mb-3 size-9" aria-hidden="true" />
              <DialogTitle className="text-2xl font-medium lowercase tracking-[-0.04em] text-foreground">
                come build brok with us.
              </DialogTitle>
              <DialogDescription className="max-w-sm lowercase leading-relaxed text-muted-foreground">
                affordable ai, a tiny founding crew, and zero weird pricing
                math.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <fieldset>
                <legend className="mb-2 text-xs lowercase text-muted-foreground">
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
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background/60 text-foreground hover:border-primary/40'
                      )}
                    >
                      <span className="block text-xl font-medium tracking-[-0.04em]">
                        {option.price}
                      </span>
                      <span
                        className={cn(
                          'block text-xs lowercase',
                          plan === option.id
                            ? 'text-primary-foreground/65'
                            : 'text-muted-foreground'
                        )}
                      >
                        {option.cadence} · {option.note}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-2xl border border-border bg-background/55 p-4">
                <p className="mb-3 text-xs lowercase text-muted-foreground">
                  here are some features we&apos;re working on
                </p>
                <div className="space-y-2.5">
                  {upcoming.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2.5 text-sm lowercase text-foreground/80"
                    >
                      <Icon className="size-4 text-primary" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs lowercase text-muted-foreground">
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
                    className="h-12 rounded-2xl border-border bg-background/65 px-4 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
                  />
                  <Button
                    type="submit"
                    disabled={isPending}
                    aria-label="join the brok waitlist"
                    className="bg-warm size-12 shrink-0 rounded-2xl p-0 text-primary-foreground hover:opacity-90"
                  >
                    {isPending ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
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
