import {
  createInsForgeServerClient,
  normalizeInsForgeUser
} from '@/lib/insforge/auth'
import { perfLog } from '@/lib/utils/perf-logging'
import { incrementAuthCallCount } from '@/lib/utils/perf-tracking'

export async function getCurrentUser() {
  try {
    const insforge = await createInsForgeServerClient()
    const { data, error } = await insforge.auth.getCurrentUser()
    if (error) {
      console.error('InsForge current-user lookup failed:', error)
      return null
    }
    return normalizeInsForgeUser(data?.user)
  } catch (error) {
    console.error('InsForge current-user client failed:', error)
    return null
  }
}

export async function getCurrentUserId() {
  const count = incrementAuthCallCount()
  perfLog(`getCurrentUserId called - count: ${count}`)

  // Public brok visitors are real guests: their conversations stay ephemeral
  // and are never mixed into a shared anonymous account.
  if (process.env.PUBLIC_GUEST_MODE === 'true') {
    return undefined
  }

  // Skip authentication mode (for personal Docker deployments)
  if (process.env.ENABLE_AUTH === 'false') {
    // Guard: Prevent disabling auth in Morphic Cloud deployments
    if (process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true') {
      throw new Error(
        'ENABLE_AUTH=false is not allowed in MORPHIC_CLOUD_DEPLOYMENT'
      )
    }

    // Always warn when authentication is disabled (except in tests)
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '⚠️  Authentication disabled. Running in anonymous mode.\n' +
          '   All users share the same user ID. For personal use only.'
      )
    }

    return process.env.ANONYMOUS_USER_ID || 'anonymous-user'
  }

  const user = await getCurrentUser()
  return user?.id
}
