/**
 * @file Serving the application public key at the well-known path Tesla polls.
 *
 * Prerequisites: a PEM-encoded secp256r1 public key, generated alongside the
 * private key your Vehicle Command Proxy signs with.
 */

import { PUBLIC_KEY_PATH, publicKeyUrl } from '@bankkroll/tesdk'

/**
 * Handles a request for the well-known public key path.
 *
 * Written against Web Standard `Request`/`Response`, so the same function runs
 * unchanged on Cloudflare Workers, Deno, Bun, and Node's `fetch` server APIs.
 *
 * The file must stay reachable indefinitely: Tesla re-fetches it, and vehicles
 * stop trusting the application if it starts 404ing.
 *
 * @param request - Incoming request.
 * @param pem - PEM-encoded secp256r1 public key.
 * @returns The PEM body for the well-known path, or `undefined` for any other
 * path so the caller can fall through to its own routing.
 *
 * @example
 * ```ts
 * export default {
 *   fetch(request: Request): Response {
 *     return servePublicKey(request, env.TESLA_PUBLIC_KEY_PEM) ?? handleApp(request)
 *   },
 * }
 * ```
 */
export function servePublicKey(request: Request, pem: string): Response | undefined {
  if (new URL(request.url).pathname !== PUBLIC_KEY_PATH) return undefined

  return new Response(pem, {
    headers: {
      'content-type': 'application/x-pem-file',
      // Tesla re-reads this on every pairing attempt; a long cache turns a key
      // rotation into hours of failed pairings.
      'cache-control': 'public, max-age=300',
    },
  })
}

/**
 * Verifies from the outside that the key is reachable and looks like a PEM.
 *
 * Run this in a deploy check: partner registration succeeds against a stale
 * cache or a redirect, and the failure only shows up later at pairing time.
 *
 * @param domain - Registered application domain.
 * @throws {Error} When the key is unreachable or is not a PEM public key.
 */
export async function assertPublicKeyHosted(domain: string): Promise<void> {
  const url = publicKeyUrl(domain)
  const response = await fetch(url, { redirect: 'error' })

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}; Tesla expects 200.`)
  }

  const body = await response.text()
  if (!body.includes('-----BEGIN PUBLIC KEY-----')) {
    throw new Error(`${url} did not return a PEM public key.`)
  }
}
