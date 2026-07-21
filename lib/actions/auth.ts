'use server'

import {
  createInsForgeAuthActions,
  createInsForgeServerClient
} from '@/lib/insforge/auth'

type AuthActionResult = {
  success: boolean
  error?: string
  requiresVerification?: boolean
}

function message(error: any, fallback: string) {
  return error?.message ?? error?.error ?? fallback
}

export async function signInWithPasswordAction(
  email: string,
  password: string
): Promise<AuthActionResult> {
  const auth = await createInsForgeAuthActions()
  const { data, error } = await auth.signInWithPassword({ email, password })
  if (error || !data?.user) {
    return { success: false, error: message(error, 'Sign in failed') }
  }
  return { success: true }
}

export async function signUpAction(
  email: string,
  password: string
): Promise<AuthActionResult> {
  const auth = await createInsForgeAuthActions()
  const { data, error } = await auth.signUp({
    email,
    password,
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://brok.fyi'}/auth/login`
  })
  if (error) {
    return { success: false, error: message(error, 'Sign up failed') }
  }
  return {
    success: true,
    requiresVerification: Boolean(data?.requireEmailVerification)
  }
}

export async function signOutAction(): Promise<AuthActionResult> {
  const auth = await createInsForgeAuthActions()
  const { error } = await auth.signOut()
  return error
    ? { success: false, error: message(error, 'Sign out failed') }
    : { success: true }
}

export async function sendPasswordResetAction(
  email: string
): Promise<AuthActionResult> {
  const client = await createInsForgeServerClient()
  const { error } = await client.auth.sendResetPasswordEmail({
    email,
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://brok.fyi'}/auth/update-password`
  })
  return error
    ? { success: false, error: message(error, 'Could not send reset email') }
    : { success: true }
}

export async function resetPasswordAction(
  email: string,
  code: string,
  newPassword: string
): Promise<AuthActionResult> {
  const client = await createInsForgeServerClient()
  const { data, error: exchangeError } =
    await client.auth.exchangeResetPasswordToken({ email, code })
  if (exchangeError || !data?.token) {
    return {
      success: false,
      error: message(exchangeError, 'Invalid or expired reset code')
    }
  }
  const { error } = await client.auth.resetPassword({
    newPassword,
    otp: data.token
  })
  return error
    ? { success: false, error: message(error, 'Password reset failed') }
    : { success: true }
}
