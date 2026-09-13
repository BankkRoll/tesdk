/**
 * @file Authentication types shared by the OAuth helpers and the client.
 */

import type { Region } from '../core/regions.js'

/**
 * OAuth scopes accepted by Fleet API.
 *
 * `openid` and `offline_access` are required to receive an id token and a
 * refresh token respectively.
 */
export type Scope =
  /** Allows customers to sign in with their Tesla credentials. */
  | 'openid'
  /** Issues a refresh token so the user need not sign in again. */
  | 'offline_access'
  /** Contact information, home address, profile picture, and referrals. */
  | 'user_data'
  /** Live vehicle data, service history, upgrades, and ownership details. */
  | 'vehicle_device_data'
  /** Precise and coarse vehicle location. */
  | 'vehicle_location'
  /** Driver management, unlock, wake, remote start, and software updates. */
  | 'vehicle_cmds'
  /** Charging history, billing, and start, stop, and schedule commands. */
  | 'vehicle_charging_cmds'
  /** Energy live status, site info, and backup, energy, and charge history. */
  | 'energy_device_data'
  /** Backup reserve, operation mode, and storm mode settings. */
  | 'energy_cmds'
  /** Detailed specifications for any vehicle. Partner tokens only. */
  | 'vehicle_specs'
  /** Configuration, fees, and pricing by market and model. Partner tokens only. */
  | 'vehicle_pricing_info'
  /** Enterprise management functions for business accounts. */
  | 'enterprise_management'

/** A set of OAuth credentials with their expiry. */
export interface TokenSet {
  accessToken: string
  /** Present when `offline_access` was granted. */
  refreshToken?: string
  /** Absolute expiry as a Unix epoch timestamp in milliseconds. */
  expiresAt: number
  /** Scopes actually granted, which may be narrower than those requested. */
  scopes?: string[]
  /** OpenID Connect identity token, present when `openid` was granted. */
  idToken?: string
  tokenType?: string
}

/**
 * Persistence adapter for tokens.
 *
 * Implementations may be synchronous or asynchronous, allowing an in-memory
 * map, `localStorage`, a KV namespace, or a database row to be used
 * interchangeably.
 */
export interface TokenStore {
  get(): TokenSet | undefined | Promise<TokenSet | undefined>
  set(tokens: TokenSet): void | Promise<void>
  clear?(): void | Promise<void>
}

/** Credentials identifying the registered application. */
export interface OAuthClientConfig {
  clientId: string
  /**
   * Application secret. Omit for public clients using PKCE, such as browser
   * and mobile applications, where a secret cannot be kept confidential.
   */
  clientSecret?: string
  redirectUri?: string
  /** Region whose authorization and token endpoints are used. Defaults to `na`. */
  region?: Region
}

/** Raw token payload as returned by the Tesla token endpoint. */
export interface RawTokenResponse {
  access_token: string
  refresh_token?: string
  id_token?: string
  expires_in: number
  token_type?: string
  scope?: string
}
