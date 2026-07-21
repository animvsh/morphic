import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.redirect(
    new URL(
      '/auth/login?message=Use%20your%20InsForge%20email%20and%20password%20to%20sign%20in.',
      request.url
    )
  )
}
