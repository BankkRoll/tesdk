/**
 * @file Finding the region an account belongs to.
 *
 * Prerequisites: a token with `openid`.
 */

import {
  REGION_BASE_URLS,
  TeslaClient,
  regionForCountry,
  type Region,
  type TokenSet,
} from 'tesdk'

/**
 * Returns a client bound to whichever region actually serves this account.
 *
 * A token is minted against one region's audience and rejected by the others,
 * so guessing wrong produces a 401 that looks like an expired token. The
 * `users/region` endpoint answers authoritatively, and `forUserRegion` returns
 * the same client when the guess was already right — so the extra request costs
 * nothing beyond itself.
 *
 * @param tokens - Token set from sign-in.
 *
 * @example
 * ```ts
 * const client = await clientForAccount(tokens)
 * ```
 */
export async function clientForAccount(tokens: TokenSet): Promise<TeslaClient> {
  return await new TeslaClient({ tokens }).forUserRegion({
    clientId: process.env['TESLA_CLIENT_ID'],
    clientSecret: process.env['TESLA_CLIENT_SECRET'],
  })
}

/**
 * Resolves a region without building a second client.
 *
 * Useful at sign-up, to store the region alongside the user so later requests
 * skip the lookup entirely.
 *
 * @param tokens - Token set from sign-in.
 * @returns The region code and its base URL.
 */
export async function discoverRegion(
  tokens: TokenSet,
): Promise<{ region: string; baseUrl: string }> {
  const { region, fleet_api_base_url: baseUrl } = await new TeslaClient({ tokens }).user.region()
  return { region, baseUrl }
}

/**
 * Guesses a region from a country code, for use before any token exists.
 *
 * Only a starting point: Asia-Pacific markets are served by the `na` cluster,
 * which surprises people, and an account can be moved. Confirm with
 * {@link discoverRegion} once a token is in hand.
 *
 * @param countryCode - ISO 3166-1 alpha-2 code.
 * @param fallback - Region to use for unsupported countries.
 */
export function guessRegion(countryCode: string, fallback: Region = 'na'): Region {
  return regionForCountry(countryCode) ?? fallback
}

/**
 * Maps a stored base URL back to a region code.
 *
 * @param baseUrl - Base URL previously returned by the region endpoint.
 * @returns The region, or `undefined` for a proxy or an unrecognized host.
 */
export function regionForBaseUrl(baseUrl: string): Region | undefined {
  const normalized = baseUrl.replace(/\/+$/, '')
  const regions: Region[] = ['na', 'eu', 'cn']
  return regions.find((region) => REGION_BASE_URLS[region] === normalized)
}
