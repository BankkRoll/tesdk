import 'server-only'

/**
 * @file Session handling for the Tesla OAuth flow.
 *
 * Tokens live in an httpOnly cookie and never reach the browser as readable
 * values. Every Fleet API call runs on the server, which also sidesteps CORS:
 * Tesla does not send permissive CORS headers, so a browser cannot call the
 * API directly.
 *
 * The cookie here holds the token set directly, which keeps the example
 * self-contained. A production app should store an opaque session id and keep
 * the refresh token in a database, so that a leaked cookie can be revoked and
 * the token survives the 4 KB cookie size limit.
 */

import { cookies } from 'next/headers'
import { TeslaClient, createTokenStore, type Region, type TokenSet } from '@bankkroll/tesdk'

/** Name of the cookie holding the serialized token set. */
const SESSION_COOKIE = 'tesla_session'

/** Name of the short-lived cookie holding PKCE and CSRF state. */
const OAUTH_STATE_COOKIE = 'tesla_oauth'

/** Values carried between the authorize redirect and the callback. */
export interface OAuthState {
  /** Anti-forgery value echoed back by the authorization server. */
  state: string
  /** PKCE verifier, exchanged for tokens and never sent on the redirect. */
  verifier: string
}

/** Reads the application configuration, failing fast when it is incomplete. */
export function appConfig(): {
  clientId: string
  clientSecret: string
  region: Region
  redirectUri: string
} {
  const clientId = process.env['TESLA_CLIENT_ID']
  const clientSecret = process.env['TESLA_CLIENT_SECRET']

  if (!clientId || !clientSecret) {
    throw new Error('TESLA_CLIENT_ID and TESLA_CLIENT_SECRET must be set. See .env.example.')
  }

  return {
    clientId,
    clientSecret,
    region: (process.env['TESLA_REGION'] ?? 'na') as Region,
    redirectUri: process.env['TESLA_REDIRECT_URI'] ?? 'http://localhost:3000/api/auth/callback',
  }
}

/** Whether cookies should carry the `Secure` attribute. */
const secureCookies = process.env.NODE_ENV === 'production'

/** Stores the pending PKCE verifier and CSRF state for the callback. */
export async function setOAuthState(value: OAuthState): Promise<void> {
  const store = await cookies()
  store.set(OAUTH_STATE_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
}

/** Reads and clears the pending OAuth state. */
export async function takeOAuthState(): Promise<OAuthState | undefined> {
  const store = await cookies()
  const raw = store.get(OAUTH_STATE_COOKIE)?.value
  store.delete(OAUTH_STATE_COOKIE)

  if (!raw) return undefined
  try {
    return JSON.parse(raw) as OAuthState
  } catch {
    return undefined
  }
}

/** Persists a token set for the browser session. */
export async function setSession(tokens: TokenSet): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, JSON.stringify(tokens), {
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

/** Reads the current token set, if the visitor is signed in. */
export async function getSession(): Promise<TokenSet | undefined> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as TokenSet
  } catch {
    return undefined
  }
}

/** Clears the session cookie. */
export async function clearSession(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}

/**
 * Builds a client for the current request.
 *
 * The token store writes refreshed credentials straight back to the cookie,
 * so a rotated refresh token survives beyond the current response.
 *
 * @param tokens - Existing credentials, omitted during the login flow.
 */
export function createClient(tokens?: TokenSet): TeslaClient {
  const config = appConfig()

  return new TeslaClient({
    region: config.region,
    // A Vehicle Command Proxy address replaces the regional host so that
    // commands are signed before they reach Fleet API.
    baseUrl: process.env['TESLA_PROXY_URL'],
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    tokenStore: createTokenStore({
      get: () => tokens,
      set: async (next) => {
        await setSession(next)
      },
    }),
  })
}

/**
 * Returns a client for the signed-in visitor.
 *
 * @returns The client, or `undefined` when no session exists.
 */
export async function clientFromSession(): Promise<TeslaClient | undefined> {
  const tokens = await getSession()
  return tokens ? createClient(tokens) : undefined
}
