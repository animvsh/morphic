'use client'

import { useState } from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils/index'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { PasswordInput } from './ui/password-input'

export function LoginForm({
  className,
  message,
  redirectTo = '/',
  admin = false,
  ...props
}: React.ComponentPropsWithoutRef<'div'> & {
  message?: string
  redirectTo?: string
  admin?: boolean
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'continue', email, password })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'could not continue')
      window.location.assign(redirectTo)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={cn('flex flex-col items-center gap-6', className)}
      {...props}
    >
      <Card className="w-full max-w-sm rounded-[28px] border-black/[0.08] bg-[#f8f8f6] shadow-[0_24px_80px_rgba(0,0,0,0.09)]">
        <CardHeader className="text-center">
          <CardTitle className="flex flex-col items-center justify-center gap-5 text-2xl lowercase tracking-[-0.035em]">
            <span className="size-11 rounded-[13px] bg-black shadow-[0_1px_0_rgba(255,255,255,0.25)_inset]" />
            {admin ? 'brok admin' : 'welcome to brok'}
          </CardTitle>
          <CardDescription className="mx-auto max-w-[30ch] lowercase leading-5">
            {admin
              ? 'restricted operations console for authorized brok staff.'
              : 'one account for your chats, searches, and everything worth keeping.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <p className="mb-4 rounded-xl bg-black/[0.04] px-3 py-2.5 text-center text-xs lowercase leading-5 text-black/55">
              {message}
            </p>
          )}
          <div className="flex flex-col gap-4">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email" className="lowercase">
                  email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@ucsc.edu"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password" className="lowercase">
                    password
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  type="password"
                  placeholder="********"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'one sec...' : 'continue'}
              </Button>
            </form>
          </div>
          {!admin && (
            <div className="mt-6 text-center text-xs lowercase leading-5 text-black/45">
              new here? we&apos;ll make your account as you go.
            </div>
          )}
        </CardContent>
      </Card>
      <div className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          &larr; back to brok
        </Link>
      </div>
    </div>
  )
}
