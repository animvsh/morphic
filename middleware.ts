import { type NextRequest, NextResponse } from 'next/server'

import { updateSession } from '@insforge/sdk/ssr/middleware'

export async function middleware(request: NextRequest) {
  const protocol =
    request.headers.get('x-forwarded-proto') || request.nextUrl.protocol
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const baseUrl = `${protocol}${protocol.endsWith(':') ? '//' : '://'}${host}`

  const hostname = host.split(':')[0].toLowerCase()
  const adminHostname = new URL(
    process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.brok.fyi'
  ).hostname
  const isAdminHost = hostname === adminHostname
  const isPublicBrokHost =
    hostname === 'brok.fyi' || hostname === 'www.brok.fyi'
  const isAdminPath =
    request.nextUrl.pathname === '/admin' ||
    request.nextUrl.pathname.startsWith('/admin/') ||
    request.nextUrl.pathname.startsWith('/api/admin/')

  if (isPublicBrokHost && isAdminPath) {
    return new NextResponse('Not Found', { status: 404 })
  }

  let response: NextResponse
  if (
    isAdminHost &&
    !request.nextUrl.pathname.startsWith('/admin') &&
    !request.nextUrl.pathname.startsWith('/api/') &&
    !request.nextUrl.pathname.startsWith('/auth/')
  ) {
    const rewritten = request.nextUrl.clone()
    rewritten.pathname =
      request.nextUrl.pathname === '/'
        ? '/admin'
        : `/admin${request.nextUrl.pathname}`
    response = NextResponse.rewrite(rewritten, { request })
  } else {
    response = NextResponse.next({ request })
  }
  const authBaseUrl =
    process.env.INSFORGE_URL ?? process.env.NEXT_PUBLIC_INSFORGE_URL
  const authAnonKey =
    process.env.INSFORGE_ANON_KEY ?? process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
  const secure = (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://')
  if (authBaseUrl && authAnonKey) {
    await updateSession({
      baseUrl: authBaseUrl,
      anonKey: authAnonKey,
      options: {
        accessToken: { secure },
        refreshToken: { secure }
      },
      requestCookies: request.cookies as any,
      responseCookies: response.cookies
    })
  }

  response.headers.set('x-url', request.url)
  response.headers.set('x-host', host)
  response.headers.set('x-protocol', protocol)
  response.headers.set('x-base-url', baseUrl)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
