'use client'

import { useState } from 'react'
import Link from 'next/link'

import { sendPasswordResetAction } from '@/lib/actions/auth'
import { cn } from '@/lib/utils/index'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { IconLogo } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await sendPasswordResetAction(email)
      if (!result.success) throw new Error(result.error)
      setSuccess(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6 lowercase', className)} {...props}>
      {success ? (
        <Card className="rounded-[28px] border-border bg-card/95 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <IconLogo className="mb-2 size-10" aria-label="brok labs logo" />
            <CardTitle className="text-2xl">check your email</CardTitle>
            <CardDescription>password reset instructions sent</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              If you registered using your email and password, you will receive
              a password reset email.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[28px] border-border bg-card/95 shadow-2xl backdrop-blur-xl">
          <CardHeader>
            <IconLogo className="mb-2 size-10" aria-label="brok labs logo" />
            <CardTitle className="text-2xl">reset your password</CardTitle>
            <CardDescription>
              enter your email and we&apos;ll send you a reset code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'sending...' : 'send reset email'}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                already have an account?{' '}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
