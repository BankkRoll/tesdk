/**
 * @file Development proxy that stands in for a production backend.
 *
 * Tesla's Fleet API and identity service send no permissive CORS headers, so a
 * browser cannot call either one directly: the preflight fails and the request
 * never reaches Tesla. Every browser integration therefore needs a server hop,
 * and this plugin is that hop for `npm run dev`.
 *
 * Two paths are handled, both same-origin from the browser's point of view:
 *
 * - `/tesla/*` forwards to Fleet API (or to a Vehicle Command Proxy when
 *   `TESLA_PROXY_URL` is set), passing the caller's `Authorization` header
 *   through unchanged.
 * - `/oauth/token` forwards form-encoded grant requests to the regional token
 *   endpoint, which is a distinct host from Fleet API.
 *
 * Nothing here adds credentials. This example authenticates as a public client
 * with PKCE, so there is no secret to inject, and the proxy exists purely to
 * satisfy the same-origin policy. A production deployment replaces it with a
 * real backend that also owns the session; see the README.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { request as httpRequest } from 'node:http'
import { Agent, request as httpsRequest } from 'node:https'
import { REGION_BASE_URLS, TOKEN_URLS, type Region } from '@bankkroll/tesdk'
import type { Connect, Plugin } from 'vite'

/** Path prefix the SPA sends Fleet API requests to. */
export const FLEET_PREFIX = '/tesla'

/** Path the SPA posts OAuth grant requests to. */
export const TOKEN_PATH = '/oauth/token'

/**
 * Request headers forwarded upstream.
 *
 * An allowlist rather than a copy of everything: `host` must be rewritten for
 * TLS SNI to match, and hop-by-hop headers such as `connection` are invalid to
 * relay.
 */
const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept'] as const

/**
 * Response headers returned to the browser.
 *
 * `x-txid` is Tesla's request identifier, surfaced by `TeslaError.requestId`
 * and the first thing Tesla support asks for, so it must survive the hop.
 */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'retry-after', 'x-txid'] as const

/** Options for {@link teslaDevProxy}. */
export interface TeslaDevProxyOptions {
  /** Region whose Fleet API and token hosts are used. */
  region: Region
  /**
   * Overrides the Fleet API host, typically a Vehicle Command Proxy address.
   *
   * The token endpoint is never overridden: signing proxies do not implement
   * it, and grant requests must reach Tesla's identity service directly.
   */
  upstream?: string | undefined
  /**
   * Accepts self-signed upstream certificates.
   *
   * The Vehicle Command Proxy generates its own certificate by default, which
   * Node rejects without this. Development only.
   */
  insecure?: boolean
}

/** A single upstream hop, resolved once at plugin creation. */
interface Upstream {
  origin: string
  agent: Agent | undefined
}

/**
 * Streams one request upstream and pipes the response back.
 *
 * Uses the Node HTTP modules directly rather than `fetch` so the request and
 * response bodies stream rather than buffer, which matters for the
 * multi-megabyte `vehicle_data` payload.
 *
 * The transport is chosen from the target protocol: Tesla is always HTTPS, but
 * a locally hosted Vehicle Command Proxy or mock server is commonly plain HTTP.
 */
function forward(
  upstream: Upstream,
  path: string,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
): void {
  const target = new URL(path, upstream.origin)
  const headers: Record<string, string> = {}

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.headers[name]
    if (typeof value === 'string') headers[name] = value
  }

  const overHttp = target.protocol === 'http:'
  const sendRequest = overHttp ? httpRequest : httpsRequest

  const proxied = sendRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: incoming.method ?? 'GET',
      headers,
      // The keep-alive agent is an HTTPS agent, so it is omitted for a
      // plain-HTTP upstream where it would be the wrong type.
      ...(upstream.agent && !overHttp ? { agent: upstream.agent } : {}),
    },
    (response) => {
      outgoing.statusCode = response.statusCode ?? 502
      for (const name of FORWARDED_RESPONSE_HEADERS) {
        const value = response.headers[name]
        if (typeof value === 'string') outgoing.setHeader(name, value)
      }
      response.pipe(outgoing)
    },
  )

  proxied.on('error', (error: Error) => {
    outgoing.statusCode = 502
    outgoing.setHeader('content-type', 'application/json')
    outgoing.end(
      JSON.stringify({
        error: `Dev proxy could not reach ${target.origin}`,
        cause: error.message,
      }),
    )
  })

  incoming.pipe(proxied)
}

/**
 * Creates the Vite plugin serving {@link FLEET_PREFIX} and {@link TOKEN_PATH}.
 *
 * @param options - Region and optional upstream override.
 * @returns A Vite plugin, active only for `vite dev` and `vite preview`.
 *
 * @example
 * ```ts
 * export default defineConfig({ plugins: [teslaDevProxy({ region: 'na' })] })
 * ```
 */
export function teslaDevProxy(options: TeslaDevProxyOptions): Plugin {
  // A shared agent keeps connections alive across the many small requests a
  // dashboard makes, and carries the self-signed-certificate exemption.
  const agent = options.insecure
    ? new Agent({ rejectUnauthorized: false, keepAlive: true })
    : undefined

  const fleet: Upstream = {
    origin: options.upstream ?? REGION_BASE_URLS[options.region],
    agent,
  }
  const identity: Upstream = { origin: TOKEN_URLS[options.region], agent: undefined }

  const middleware: Connect.NextHandleFunction = (incoming, outgoing, next) => {
    const url = incoming.url ?? '/'

    if (url === TOKEN_PATH) {
      forward(identity, new URL(identity.origin).pathname, incoming, outgoing)
      return
    }

    if (url.startsWith(`${FLEET_PREFIX}/`)) {
      forward(fleet, url.slice(FLEET_PREFIX.length), incoming, outgoing)
      return
    }

    next()
  }

  return {
    name: 'tesla-dev-proxy',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
