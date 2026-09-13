/**
 * @file Application configuration read from Vite's environment.
 *
 * Only `VITE_`-prefixed variables are inlined into the bundle, which is the
 * safeguard that keeps server-only values out of browser JavaScript. Nothing
 * here is secret: this example runs as an OAuth public client, so the client
 * id and redirect URI are the whole configuration surface.
 */

import type { Region, Scope } from 'tesdk'

/** Regions the SDK routes to, used to validate the configured value. */
const REGIONS: readonly Region[] = ['na', 'eu', 'cn']

/** Resolved configuration for the running app. */
export interface AppConfig {
  /** Application client id from the Tesla developer portal. */
  clientId: string
  /** Region whose Fleet API and identity hosts are used. */
  region: Region
  /** Redirect URI registered on the Tesla application. */
  redirectUri: string
}

/**
 * Scopes requested at login.
 *
 * `openid` and `offline_access` are appended by the SDK, so this lists only
 * what the UI actually reads and actuates.
 */
export const SCOPES: readonly Scope[] = [
  'user_data',
  'vehicle_device_data',
  'vehicle_cmds',
  'vehicle_charging_cmds',
]

/**
 * Reads the configuration, failing fast when it is incomplete.
 *
 * @returns The resolved configuration.
 * @throws {Error} When `VITE_TESLA_CLIENT_ID` is missing or the region is
 * not one of `na`, `eu`, or `cn`.
 */
export function appConfig(): AppConfig {
  const clientId = import.meta.env.VITE_TESLA_CLIENT_ID
  if (!clientId) {
    throw new Error('VITE_TESLA_CLIENT_ID must be set. Copy .env.example to .env.local.')
  }

  const region = import.meta.env.VITE_TESLA_REGION ?? 'na'
  if (!REGIONS.includes(region as Region)) {
    throw new Error(`VITE_TESLA_REGION must be one of ${REGIONS.join(', ')}, got "${region}".`)
  }

  return {
    clientId,
    region: region as Region,
    redirectUri:
      import.meta.env.VITE_TESLA_REDIRECT_URI ?? new URL('/callback', location.origin).toString(),
  }
}
