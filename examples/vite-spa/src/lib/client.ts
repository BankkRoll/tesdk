/**
 * @file Constructs the {@link TeslaClient} the whole app shares.
 *
 * Everything in here exists to route the SDK's two upstreams through the
 * same-origin dev proxy, because Tesla answers no CORS preflight:
 *
 * - **Fleet API** is redirected with `baseUrl`, a first-class SDK option.
 * - **The token endpoint** is not configurable — `TOKEN_URLS` is a constant
 *   inside the SDK — so a wrapping `fetch` rewrites that one absolute URL.
 *
 * The SDK is otherwise untouched: retries, refresh, and error mapping all run
 * exactly as they would on a server.
 */

import { TeslaClient, TOKEN_URLS, createTokenStore, type TokenSet } from 'tesdk'
import { appConfig } from './config.ts'

/** Same-origin prefix the dev proxy forwards to Fleet API. */
const FLEET_PREFIX = '/tesla'

/** Same-origin path the dev proxy forwards to the regional token endpoint. */
const TOKEN_PATH = '/oauth/token'

/** Every regional token URL, so a client built for any region still matches. */
const TOKEN_ENDPOINTS = new Set<string>(Object.values(TOKEN_URLS))

/**
 * Wraps `fetch` so OAuth grant requests go to the same-origin proxy.
 *
 * @param input - Request target, as passed by the SDK.
 * @param init - Request options, forwarded unchanged.
 */
function proxiedFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = input instanceof Request ? input.url : input.toString()
  return fetch(TOKEN_ENDPOINTS.has(url) ? TOKEN_PATH : input, init)
}

/**
 * Builds a client for the current visitor.
 *
 * @param tokens - Existing credentials, omitted while building an authorize
 * URL or exchanging a code.
 * @param onTokens - Called whenever the SDK mints or refreshes tokens, so the
 * caller can persist the rotated refresh token.
 * @returns A client bound to the dev proxy.
 *
 * @example
 * ```ts
 * const client = createClient(tokens, saveSession)
 * const vehicles = await client.vehicles.list()
 * ```
 */
export function createClient(
  tokens: TokenSet | undefined,
  onTokens: (next: TokenSet) => void,
): TeslaClient {
  const config = appConfig()

  return new TeslaClient({
    baseUrl: new URL(FLEET_PREFIX, location.origin).toString(),
    clientId: config.clientId,
    // No clientSecret: this is a public client authenticating with PKCE. A
    // secret shipped to a browser is a published secret.
    redirectUri: config.redirectUri,
    fetch: proxiedFetch,
    tokenStore: createTokenStore({ get: () => tokens, set: onTokens }),
  })
}
