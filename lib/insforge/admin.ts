import { createClient } from '@insforge/sdk'

import 'server-only'

let adminClient: ReturnType<typeof createClient> | null = null

export function getInsForgeAdminClient() {
  const baseUrl = process.env.INSFORGE_URL
  const apiKey = process.env.INSFORGE_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error(
      'InsForge is not configured. Set INSFORGE_URL and INSFORGE_API_KEY.'
    )
  }

  if (!adminClient) {
    // InsForge OSS 2.0 authenticates project API keys with x-api-key.
    // Keeping this in the server-only client avoids exposing the key in the UI.
    adminClient = createClient({
      baseUrl,
      headers: { 'x-api-key': apiKey },
      isServerMode: true
    })
  }

  return adminClient
}
