/**
 * @file Automatic and manual token refresh.
 *
 * Prerequisites: a stored token set containing a refresh token, which requires
 * that `offline_access` was granted.
 */

import { TeslaClient, type TokenSet, type Vehicle } from 'tesdk'

/**
 * Builds a client that refreshes on its own.
 *
 * The access token is renewed one minute before expiry, and concurrent requests
 * that all find it stale share a single refresh instead of stampeding the token
 * endpoint. Nothing else in the calling code changes.
 *
 * @param tokens - Token set from a previous sign-in.
 */
export function selfRefreshingClient(tokens: TokenSet): TeslaClient {
  return new TeslaClient({
    region: 'na',
    clientId: process.env['TESLA_CLIENT_ID'],
    clientSecret: process.env['TESLA_CLIENT_SECRET'],
    tokens,
  })
}

/**
 * Demonstrates that a burst of concurrent calls triggers only one refresh.
 *
 * @param tokens - A token set that is already expired or close to expiry.
 * @returns The vehicle list, fetched five times in parallel.
 */
export async function concurrentRefresh(tokens: TokenSet): Promise<Vehicle[][]> {
  const client = selfRefreshingClient(tokens)
  return await Promise.all(Array.from({ length: 5 }, () => client.vehicles.list()))
}

/**
 * Forces a refresh ahead of schedule.
 *
 * Useful before a long-running batch, so the token cannot expire partway
 * through, and in tests that assert refresh behaviour.
 *
 * @param tokens - Token set holding the refresh token to redeem.
 * @returns The renewed token set. Tesla omits `refresh_token` on refresh
 * responses, so the SDK carries the previous one forward for you.
 */
export async function refreshNow(tokens: TokenSet): Promise<TokenSet> {
  const client = selfRefreshingClient(tokens)
  return await client.oauth.refresh()
}

/**
 * Reports how long the stored access token remains valid.
 *
 * @returns Seconds until expiry, or `undefined` when nothing is stored.
 */
export async function secondsUntilExpiry(client: TeslaClient): Promise<number | undefined> {
  const stored = await client.getTokens()
  if (!stored) return undefined
  return Math.max(0, Math.round((stored.expiresAt - Date.now()) / 1000))
}
