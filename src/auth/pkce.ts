/**
 * @file PKCE (RFC 7636) helpers built on Web Crypto.
 *
 * Uses `globalThis.crypto` only, so the same implementation works in browsers,
 * Node 20+, Deno, Bun, and edge runtimes without a polyfill.
 */

/** A PKCE verifier and its derived challenge. */
export interface PkcePair {
  /** High-entropy secret retained by the client until the token exchange. */
  verifier: string
  /** SHA-256 hash of the verifier, sent on the authorization request. */
  challenge: string
  /** Challenge method, always `S256`; the `plain` method is not supported. */
  method: 'S256'
}

/**
 * Encodes bytes as base64url without padding, per RFC 4648 §5.
 *
 * @internal
 */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generates a cryptographically random URL-safe string.
 *
 * @param byteLength - Number of random bytes before encoding. Defaults to `32`.
 * @returns A base64url string suitable for a `state` or `nonce` parameter.
 *
 * @example
 * ```ts
 * const state = randomString()
 * ```
 */
export function randomString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

/**
 * Creates a PKCE verifier and its S256 challenge.
 *
 * Store the verifier alongside the `state` value and supply it to the token
 * exchange; it must never be transmitted on the authorization request.
 *
 * @example
 * ```ts
 * const pkce = await createPkcePair()
 * const url = client.oauth.authorizeUrl({ scopes, state, pkce })
 * ```
 */
export async function createPkcePair(): Promise<PkcePair> {
  const verifier = randomString(32)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)), method: 'S256' }
}
