import { type NextRequest, NextResponse } from 'next/server'

import { createAuthActions } from '@insforge/sdk/ssr'

import {
  createInsForgeServerClient,
  getInsForgeAuthConfig,
  normalizeInsForgeUser
} from '@/lib/insforge/auth'

type AuthRequest = {
  mode?: 'continue' | 'sign-in' | 'sign-up'
  email?: string
  password?: string
}

function openSidebar(response: NextResponse) {
  response.cookies.set('sidebar_state', 'true', {
    httpOnly: false,
    sameSite: 'lax',
    secure: (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://'),
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  })
}

async function signUp(
  auth: ReturnType<typeof actions>,
  response: NextResponse,
  email: string,
  password: string
) {
  const { data, error } = await auth.signUp({
    email,
    password,
    name: email.split('@')[0],
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://brok.fyi'}/auth/login`
  })
  if (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Sign up failed') },
      { status: 400 }
    )
  }

  const requiresVerification = Boolean(data?.requireEmailVerification)
  if (!requiresVerification && !data?.user) {
    const signedIn = await auth.signInWithPassword({ email, password })
    if (signedIn.error || !signedIn.data?.user) {
      return NextResponse.json(
        { error: errorMessage(signedIn.error, 'Sign in failed') },
        { status: 400 }
      )
    }
  }

  openSidebar(response)
  return NextResponse.json(
    { success: true, created: true, requiresVerification },
    { headers: response.headers }
  )
}

function errorMessage(error: any, fallback: string) {
  return error?.message ?? error?.error ?? fallback
}

function actions(request: NextRequest, response: NextResponse) {
  return createAuthActions({
    ...getInsForgeAuthConfig(),
    requestCookies: request.cookies as any,
    responseCookies: response.cookies
  })
}

export async function GET() {
  const insforge = await createInsForgeServerClient()
  const { data, error } = await insforge.auth.getCurrentUser()
  const user = error ? null : normalizeInsForgeUser(data?.user)
  return NextResponse.json({ authenticated: Boolean(user), user })
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  let body: AuthRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !body.password) {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    )
  }

  const auth = actions(request, response)
  if (body.mode === 'sign-up') {
    return signUp(auth, response, email, body.password)
  }

  if (body.mode === 'continue') {
    const signedIn = await auth.signInWithPassword({
      email,
      password: body.password
    })
    if (!signedIn.error && signedIn.data?.user) {
      openSidebar(response)
      return NextResponse.json(
        { success: true, created: false, requiresVerification: false },
        { headers: response.headers }
      )
    }

    const created = await signUp(auth, response, email, body.password)
    if (created.ok) return created

    const failure = (await created
      .clone()
      .json()
      .catch(() => null)) as {
      error?: string
    } | null
    if (/already|exists|registered/i.test(failure?.error ?? '')) {
      return NextResponse.json(
        {
          error: "couldn't continue. check your password or reset it."
        },
        { status: 401 }
      )
    }
    return created
  }

  if (body.mode !== 'sign-in') {
    return NextResponse.json({ error: 'Invalid auth mode' }, { status: 400 })
  }

  const { data, error } = await auth.signInWithPassword({
    email,
    password: body.password
  })
  if (error || !data?.user) {
    return NextResponse.json(
      { error: errorMessage(error, 'Sign in failed') },
      { status: 401 }
    )
  }
  openSidebar(response)
  return response
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  const { error } = await actions(request, response).signOut()
  if (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Sign out failed') },
      { status: 400, headers: response.headers }
    )
  }
  return response
}
