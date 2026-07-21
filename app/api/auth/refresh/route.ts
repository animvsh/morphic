import { createRefreshAuthRouter } from '@insforge/sdk/ssr'

const baseUrl = process.env.INSFORGE_URL ?? process.env.NEXT_PUBLIC_INSFORGE_URL
const anonKey =
  process.env.INSFORGE_ANON_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
const secure = (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://')

export const { POST } = createRefreshAuthRouter({
  baseUrl,
  anonKey,
  options: {
    accessToken: { secure },
    refreshToken: { secure }
  }
})
