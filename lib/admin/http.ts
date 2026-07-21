import { NextResponse } from 'next/server'

import { AdminAuthorizationError } from './auth'

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error('Admin API error:', error)
  return NextResponse.json(
    { error: 'Unable to complete the admin request' },
    { status: 500 }
  )
}
