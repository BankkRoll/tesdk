/**
 * @file Authorization-code flow with PKCE, split across the two HTTP requests
 * it actually spans.
 *
 * Prerequisites: a registered application with `TESLA_CLIENT_ID` and a redirect
 * URI allowed on developer.tesla.com.
 */

import { TeslaClient, createPkcePair, randomString, type Scope, type TokenSet } from '@bankkroll/tesdk'

/** Values that must survive between the redirect and the callback. */
export interface PendingAuthorization {
  /** URL to send the user to. */
  authorizeUrl: string
  /** PKCE verifier, exchanged for tokens and never sent on the redirect. */
  codeVerifier: string
  /** Anti-forgery value echoed back on the callback. */
  state: string
}

const REDIRECT_URI = 'https://example.com/callback'

/**
 * Builds the consent URL and the secrets that the callback needs.
 *
 * Persist `codeVerifier` and `state` against the user's session — a cookie, a
 * signed JWT, or a session row. They are single-use and short-lived.
 *
 * @param scopes - Scopes to request. `openid` and `offline_access` are added
 * by the SDK, so a refresh token always comes back.
 * @returns The URL to redirect to, plus the secrets to store.
 */
export async function beginAuthorization(scopes: Scope[]): Promise<PendingAuthorization> {
  const client = new TeslaClient({
    clientId: process.env['TESLA_CLIENT_ID'],
    redirectUri: REDIRECT_URI,
  })

  const pkce = await createPkcePair()
  const state = randomString()

  return {
    authorizeUrl: client.oauth.authorizeUrl({ scopes, state, pkce }),
    codeVerifier: pkce.verifier,
    state,
  }
}

/**
 * Completes the flow from the query parameters Tesla redirected back with.
 *
 * @param params - `code` and `state` from the callback URL.
 * @param pending - The values stored by {@link beginAuthorization}.
 * @returns The token set, also written to the client's token store.
 * @throws {Error} When `state` does not match, which indicates CSRF.
 *
 * @example
 * ```ts
 * const url = new URL(request.url)
 * const tokens = await completeAuthorization(
 *   { code: url.searchParams.get('code') ?? '', state: url.searchParams.get('state') ?? '' },
 *   pending,
 * )
 * ```
 */
export async function completeAuthorization(
  params: { code: string; state: string },
  pending: PendingAuthorization,
): Promise<TokenSet> {
  // Comparing state before touching the code keeps an attacker-supplied code
  // from ever reaching the token endpoint.
  if (params.state !== pending.state) {
    throw new Error('OAuth state mismatch: the callback did not originate from this session.')
  }

  const client = new TeslaClient({
    clientId: process.env['TESLA_CLIENT_ID'],
    clientSecret: process.env['TESLA_CLIENT_SECRET'],
    redirectUri: REDIRECT_URI,
  })

  return await client.oauth.exchangeCode({
    code: params.code,
    codeVerifier: pending.codeVerifier,
  })
}
