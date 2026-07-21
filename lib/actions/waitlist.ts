'use server'

import { getInsForgeAdminClient } from '@/lib/insforge/admin'

export type WaitlistPlan = 'monthly' | 'annual'

export async function joinWaitlist(input: {
  email: string
  plan: WaitlistPlan
}): Promise<{ success: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { success: false, error: 'pop in a real email and try again' }
  }

  if (input.plan !== 'monthly' && input.plan !== 'annual') {
    return { success: false, error: 'pick a plan to join' }
  }

  try {
    const client = getInsForgeAdminClient()
    const { error } = await client.database.from('brok_waitlist').upsert({
      email,
      plan: input.plan,
      status: 'requested',
      source: 'guest-home'
    })

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Failed to join brok waitlist:', error)
    return { success: false, error: 'that did not stick. give it one more go?' }
  }
}
