import { cookies } from 'next/headers'

import { createAuthActions, createServerClient } from '@insforge/sdk/ssr'

import 'server-only'

export type AppUser = {
  id: string
  email?: string
  user_metadata: Record<string, any>
}

export function getInsForgeAuthConfig() {
  const baseUrl =
    process.env.INSFORGE_URL ?? process.env.NEXT_PUBLIC_INSFORGE_URL
  const anonKey =
    process.env.INSFORGE_ANON_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
  if (!baseUrl || !anonKey) {
    throw new Error('InsForge auth is not configured')
  }
  const secure = (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://')
  return {
    baseUrl,
    anonKey,
    options: {
      accessToken: { secure },
      refreshToken: { secure }
    }
  }
}

export async function createInsForgeServerClient() {
  return createServerClient({
    ...getInsForgeAuthConfig(),
    cookies: await cookies()
  })
}

export async function createInsForgeAuthActions() {
  return createAuthActions({
    ...getInsForgeAuthConfig(),
    cookies: await cookies()
  })
}

export function normalizeInsForgeUser(user: any): AppUser | null {
  if (!user?.id) return null
  const profile =
    user.profile && typeof user.profile === 'object' ? user.profile : {}
  return {
    id: String(user.id),
    email: typeof user.email === 'string' ? user.email : undefined,
    user_metadata: {
      ...profile,
      name: profile.name ?? user.name,
      full_name: profile.full_name ?? profile.name ?? user.name,
      avatar_url: profile.avatar_url ?? user.avatar_url
    }
  }
}
