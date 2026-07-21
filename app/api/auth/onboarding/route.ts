import { NextResponse } from 'next/server'

import { createInsForgeServerClient } from '@/lib/insforge/auth'

type OnboardingRequest = {
  completed?: boolean
}

export async function POST(request: Request) {
  let body: OnboardingRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  if (body.completed !== true) {
    return NextResponse.json(
      { error: 'onboarding must be completed' },
      { status: 400 }
    )
  }

  const insforge = await createInsForgeServerClient()
  const current = await insforge.auth.getCurrentUser()
  if (current.error || !current.data?.user) {
    return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  }

  const existingProfile =
    current.data.user.profile && typeof current.data.user.profile === 'object'
      ? current.data.user.profile
      : {}
  const { error } = await insforge.auth.setProfile({
    ...existingProfile,
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString()
  })
  if (error) {
    return NextResponse.json(
      { error: error.message ?? 'could not save onboarding' },
      { status: 502 }
    )
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('sidebar_state', 'true', {
    httpOnly: false,
    sameSite: 'lax',
    secure: (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://'),
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })
  return response
}
