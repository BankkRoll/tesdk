/**
 * @file OAuth 2.0 client for Fleet API.
 *
 * Implements the authorization-code flow with optional PKCE, the
 * `client_credentials` flow used for partner tokens, and refresh handling with
 * single-flight deduplication.
 */

import { AuthenticationError, TeslaError } from '../core/errors.js'
import type { FetchLike } from '../core/http.js'
import { AUTHORIZE_URLS, REGION_BASE_URLS, TOKEN_URLS, type Region } from '../core/regions.js'
import type { PkcePair } from './pkce.js'
import type { OAuthClientConfig, RawTokenResponse, Scope, TokenSet, TokenStore } from './types.js'

/** Parameters for {@link OAuthClient.authorizeUrl}. */
export interface AuthorizeUrlOptions {
  /** Scopes to request. `openid` and `offline_access` are added automatically. */
  scopes: Scope[]
  /** Opaque anti-forgery value echoed back to the redirect URI. */
  state: string
  /** PKCE pair from `createPkcePair`, required for public clients. */
  pkce?: PkcePair
  /** Overrides the redirect URI configured on the client. */
  redirectUri?: string
  /** Forces the account chooser or consent screen to be shown. */
  prompt?: 'login' | 'consent'
  /** OpenID Connect nonce, bound to the resulting id token. */
  nonce?: string
}

/** Parameters for {@link OAuthClient.exchangeCode}. */
export interface ExchangeCodeOptions {
  /** Authorization code from the redirect callback. */
  code: string
  /** PKCE verifier matching the challenge sent on the authorization request. */
  codeVerifier?: string
  redirectUri?: string
}

/**
 * Refresh tokens are re-used this many milliseconds before actual expiry, so a
 * request is never sent with a token that expires in flight.
 */
const EXPIRY_SKEW_MS = 60_000

/**
 * Converts a raw token payload into a {@link TokenSet} with absolute expiry.
 *
 * @internal
 */
function toTokenSet(raw: RawTokenResponse): TokenSet {
  return {
    accessToken: raw.access_token,
    ...(raw.refresh_token !== undefined ? { refreshToken: raw.refresh_token } : {}),
    ...(raw.id_token !== undefined ? { idToken: raw.id_token } : {}),
    expiresAt: Date.now() + raw.expires_in * 1000,
    ...(raw.scope !== undefined ? { scopes: raw.scope.split(' ').filter(Boolean) } : {}),
    tokenType: raw.token_type ?? 'Bearer',
  }
}

/**
 * Token acquisition and renewal against the Tesla identity service.
 *
 * A single instance is safe to share across concurrent requests: overlapping
 * refreshes collapse into one network call.
 */
export class OAuthClient {
  private readonly config: OAuthClientConfig
  private readonly deps: { fetch: FetchLike; store?: TokenStore }
  private readonly region: Region
  private refreshInFlight: Promise<TokenSet> | undefined

  constructor(config: OAuthClientConfig, deps: { fetch: FetchLike; store?: TokenStore }) {
    this.config = config
    this.deps = deps
    this.region = config.region ?? 'na'
  }

  /**
   * Builds the URL that a user visits to grant access.
   *
   * @returns An absolute authorization URL to redirect the user to.
   *
   * @example
   * ```ts
   * const pkce = await createPkcePair()
   * const state = randomString()
   * const url = oauth.authorizeUrl({ scopes: ['vehicle_device_data'], state, pkce })
   * ```
   */
  authorizeUrl(options: AuthorizeUrlOptions): string {
    const redirectUri = options.redirectUri ?? this.config.redirectUri
    if (!redirectUri) {
      throw new TeslaError('A redirectUri is required to build an authorization URL')
    }

    const scopes = new Set<string>(['openid', 'offline_access', ...options.scopes])
    const url = new URL(AUTHORIZE_URLS[this.region])
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', this.config.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', [...scopes].join(' '))
    url.searchParams.set('state', options.state)
    if (options.pkce) {
      url.searchParams.set('code_challenge', options.pkce.challenge)
      url.searchParams.set('code_challenge_method', options.pkce.method)
    }
    if (options.prompt) url.searchParams.set('prompt', options.prompt)
    if (options.nonce) url.searchParams.set('nonce', options.nonce)
    return url.toString()
  }

  /**
   * Exchanges an authorization code for tokens and persists them to the store.
   *
   * @throws {AuthenticationError} When the code is invalid or already used.
   */
  async exchangeCode(options: ExchangeCodeOptions): Promise<TokenSet> {
    const redirectUri = options.redirectUri ?? this.config.redirectUri
    if (!redirectUri) throw new TeslaError('A redirectUri is required to exchange a code')

    const tokens = await this.token({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}),
      code: options.code,
      audience: REGION_BASE_URLS[this.region],
      redirect_uri: redirectUri,
      ...(options.codeVerifier ? { code_verifier: options.codeVerifier } : {}),
    })

    await this.deps.store?.set(tokens)
    return tokens
  }

  /**
   * Obtains a partner token via the `client_credentials` grant.
   *
   * Partner tokens represent the application itself rather than a user. They
   * are required for every partner endpoint, including registration, and for
   * the `vehicle_specs` and `vehicle_pricing_info` scopes.
   *
   * @param scopes - Scopes to request.
   *
   * @example
   * ```ts
   * const token = await client.oauth.clientCredentials(['openid', 'vehicle_specs'])
   * ```
   */
  async clientCredentials(scopes: Scope[]): Promise<TokenSet> {
    return await this.credentialsGrant(scopes)
  }

  /**
   * Obtains a third-party business token.
   *
   * Uses the `client_credentials` grant with the authorization code that a
   * business administrator generates from the Consent Management page in Tesla
   * for Business. The resulting token carries no user context, so the
   * endpoints under `client.user` are unavailable to it.
   *
   * @param authCode - Authorization code from Consent Management.
   * @param scopes - Scopes granted by the business.
   */
  async businessToken(authCode: string, scopes: Scope[]): Promise<TokenSet> {
    return await this.credentialsGrant(scopes, authCode)
  }

  /**
   * Runs the `client_credentials` grant, optionally carrying the business
   * authorization code.
   */
  private async credentialsGrant(scopes: Scope[], authCode?: string): Promise<TokenSet> {
    if (!this.config.clientSecret) {
      throw new TeslaError('clientSecret is required for the client_credentials grant')
    }
    const tokens = await this.token({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: scopes.join(' '),
      audience: REGION_BASE_URLS[this.region],
      ...(authCode !== undefined ? { auth_code: authCode } : {}),
    })
    await this.deps.store?.set(tokens)
    return tokens
  }

  /**
   * Exchanges a refresh token for a new token set.
   *
   * Concurrent calls share a single in-flight request, so a burst of expired
   * requests triggers only one refresh.
   *
   * @param refreshToken - Overrides the refresh token held in the store.
   */
  async refresh(refreshToken?: string): Promise<TokenSet> {
    this.refreshInFlight ??= this.performRefresh(refreshToken).finally(() => {
      this.refreshInFlight = undefined
    })
    return await this.refreshInFlight
  }

  /**
   * Returns a valid access token, refreshing it when it is expired or within
   * the expiry skew window.
   *
   * @returns The access token, or `undefined` when no credentials are stored.
   */
  async getAccessToken(): Promise<string | undefined> {
    const current = await this.deps.store?.get()
    if (!current) return undefined
    if (Date.now() < current.expiresAt - EXPIRY_SKEW_MS) return current.accessToken
    if (!current.refreshToken) return current.accessToken
    return (await this.refresh(current.refreshToken)).accessToken
  }

  private async performRefresh(refreshToken?: string): Promise<TokenSet> {
    const token = refreshToken ?? (await this.deps.store?.get())?.refreshToken
    if (!token) throw new AuthenticationError('No refresh token available')

    const tokens = await this.token({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      refresh_token: token,
    })

    // Tesla omits refresh_token on refresh responses; carry the existing one
    // forward so the session survives beyond a single renewal.
    const merged: TokenSet = { ...tokens, refreshToken: tokens.refreshToken ?? token }
    await this.deps.store?.set(merged)
    return merged
  }

  /** Posts a form-encoded grant request to the regional token endpoint. */
  private async token(params: Record<string, string>): Promise<TokenSet> {
    const response = await this.deps.fetch(TOKEN_URLS[this.region], {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams(params).toString(),
    })

    const text = await response.text()
    let payload: unknown
    try {
      payload = text ? JSON.parse(text) : undefined
    } catch {
      payload = text
    }

    if (!response.ok) {
      const record = (payload ?? {}) as Record<string, unknown>
      const message =
        (typeof record.error_description === 'string' && record.error_description) ||
        (typeof record.error === 'string' && record.error) ||
        `Token request failed with HTTP ${response.status}`
      throw new AuthenticationError(message, { status: response.status, body: payload })
    }

    return toTokenSet(payload as RawTokenResponse)
  }
}
