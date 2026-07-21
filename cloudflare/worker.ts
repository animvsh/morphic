interface Env {
  ORIGIN_URL: string
}

/**
 * Cloudflare remains the public edge for brok.fyi while Railway runs the full
 * Next.js/Morphic server that does not fit inside the free Worker bundle limit.
 * The response body is passed through untouched so AI SDK SSE stays streamed.
 */
const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url)
    const origin = new URL(env.ORIGIN_URL)
    const target = new URL(
      `${incomingUrl.pathname}${incomingUrl.search}`,
      origin
    )

    const headers = new Headers(request.headers)
    headers.set('x-forwarded-host', incomingUrl.host)
    headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''))
    headers.set('x-brok-edge', 'cloudflare')

    const originResponse = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : request.body,
      redirect: 'manual'
    })

    const responseHeaders = new Headers(originResponse.headers)
    const location = responseHeaders.get('location')
    if (location?.startsWith(origin.origin)) {
      responseHeaders.set(
        'location',
        location.replace(origin.origin, incomingUrl.origin)
      )
    }
    responseHeaders.set('x-brok-edge', 'cloudflare')

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders
    })
  }
}

export default worker
