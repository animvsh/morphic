import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  return NextResponse.redirect(
    new URL(
      '/auth/login?message=social%20sign-in%20is%20not%20enabled%20yet.',
      request.url
    )
  )
}
