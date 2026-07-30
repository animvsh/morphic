import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'

import { LoginForm } from '@/components/login-form'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ message?: string; next?: string }>
}) {
  const userId = await getCurrentUserId()
  const { message, next } = await searchParams
  const redirectTo =
    next?.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (userId) {
    redirect(redirectTo)
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm message={message} redirectTo={redirectTo} />
      </div>
    </div>
  )
}
