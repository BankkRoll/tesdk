/**
 * @file The {@link TeslaClient} entry point.
 */

import { OAuthClient } from './auth/oauth.js'
import { MemoryTokenStore } from './auth/store.js'
import type { TokenSet, TokenStore } from './auth/types.js'
import { HttpClient, type FetchLike, type RequestLogEntry, type RetryOptions } from './core/http.js'
import { resolveBaseUrl, type Region } from './core/regions.js'
import { CommandsResource } from './resources/commands.js'
import { EnergyResource } from './resources/energy.js'
import { ChargingResource } from './resources/charging.js'
import { FleetResource } from './resources/fleet.js'
import { PartnerResource } from './resources/partner.js'
import { UserResource } from './resources/user.js'
import { OcpiResource } from './resources/ocpi.js'
import { TelemetryResource } from './resources/telemetry.js'
import { VehiclesResource } from './resources/vehicles.js'

/**
 * Configuration for {@link TeslaClient}.
 *
 * Optional properties accept an explicit `undefined` so that values read
 * straight from `process.env` can be passed without narrowing.
 */
export interface TeslaClientOptions {
  /**
   * Region to route requests to.
   *
   * A token minted for one region is rejected by the others.
   *
   * @defaultValue `'na'`
   */
  region?: Region | undefined

  /**
   * Overrides the base URL derived from `region`.
   *
   * Set this to the address of a Vehicle Command Proxy so that commands are
   * signed, or to a mock server in tests.
   */
  baseUrl?: string | undefined

  /**
   * A static access token.
   *
   * Convenient for scripts. Provide `tokens` or a `tokenStore` instead when
   * the client should refresh credentials on its own.
   */
  accessToken?: string | undefined

  /** Initial token set, seeded into an in-memory store. */
  tokens?: TokenSet | undefined

  /**
   * Persistence for tokens. Required for automatic refresh across restarts.
   *
   * @defaultValue An in-memory store.
   */
  tokenStore?: TokenStore | undefined

  /**
   * OCPI credentials token for the Tesla Charging API.
   *
   * The Charging API is a separate product from the Fleet API charging
   * endpoints under `client.charging`: it exposes Tesla's public network as a
   * CPO and authenticates with OCPI's `Token` scheme rather than OAuth.
   *
   * Setting this affects only the `ocpi` namespace, which is given its own
   * transport. Fleet API calls on the same client continue to use the OAuth
   * session, so one instance can serve both products.
   *
   * @see {@link ocpiBaseUrl}
   */
  ocpiToken?: string | undefined

  /**
   * Base URL for the Charging API, supplied by Tesla during the OCPI
   * credentials handshake.
   *
   * Defaults to `baseUrl`, then to the region host. Set it whenever the
   * Charging API is served from a different origin than Fleet API.
   */
  ocpiBaseUrl?: string | undefined

  /** Application credentials, required for any OAuth operation. */
  clientId?: string | undefined
  /** Application secret. Omit for public clients using PKCE. */
  clientSecret?: string | undefined
  /** Redirect URI registered for the application. */
  redirectUri?: string | undefined

  /**
   * Request timeout in milliseconds.
   *
   * @defaultValue `30000`
   */
  timeoutMs?: number | undefined

  /** Retry policy applied to idempotent requests. */
  retry?: RetryOptions | undefined

  /**
   * `fetch` implementation to use.
   *
   * @defaultValue `globalThis.fetch`
   */
  fetch?: FetchLike | undefined

  /** Headers added to every request. */
  headers?: Record<string, string> | undefined

  /**
   * Value sent as `User-Agent` off-browser.
   *
   * @defaultValue `'tesdk/<version>'`
   */
  userAgent?: string | undefined

  /** Called once per request attempt, for logging or metrics. */
  onRequest?: ((info: RequestLogEntry) => void) | undefined
}

/**
 * Replaced at build time with the version from `package.json`, so the
 * User-Agent cannot drift when the package is bumped.
 */
declare const __TESDK_VERSION__: string | undefined

/**
 * Package version, sent in the default `User-Agent`.
 *
 * Reads `0.0.0-dev` when the source is consumed directly rather than through a
 * build, which is how the bundled examples resolve it during development.
 */
export const VERSION: string =
  typeof __TESDK_VERSION__ === 'string' ? __TESDK_VERSION__ : '0.0.0-dev'

/**
 * Client for the Tesla Fleet API.
 *
 * Runs unmodified on Node 20+, browsers, Deno, Bun, and edge runtimes. All
 * network access goes through a single {@link HttpClient}, so timeouts,
 * retries, and authentication behave identically across every namespace.
 *
 * @example Static token
 * ```ts
 * const client = new TeslaClient({ region: 'na', accessToken: process.env.TESLA_TOKEN })
 * const vehicles = await client.vehicles.list()
 * ```
 *
 * @example Automatic refresh
 * ```ts
 * const client = new TeslaClient({
 *   region: 'eu',
 *   clientId: process.env.TESLA_CLIENT_ID,
 *   clientSecret: process.env.TESLA_CLIENT_SECRET,
 *   tokens: { accessToken, refreshToken, expiresAt },
 * })
 * ```
 */
export class TeslaClient {
  /** Vehicle data, listing, and wake handling. */
  readonly vehicles: VehiclesResource
  /** Actuating vehicle commands. */
  readonly commands: CommandsResource
  /** Powerwall, Solar, and Wall Connector sites. */
  readonly energy: EnergyResource
  /** Account profile and region lookup. */
  readonly user: UserResource
  /** Charging history and invoices. */
  readonly charging: ChargingResource
  /** Partner registration and telemetry diagnostics. */
  readonly partner: PartnerResource
  /** Vehicle specifications, options, and subscriptions. */
  readonly fleet: FleetResource
  /** Fleet Telemetry configuration. */
  readonly telemetry: TelemetryResource
  /** Tesla Charging API (OCPI 2.2.1) locations and tariffs. */
  readonly ocpi: OcpiResource
  /** OAuth flows and token lifecycle. */
  readonly oauth: OAuthClient

  private readonly http: HttpClient
  private readonly store: TokenStore

  constructor(options: TeslaClientOptions = {}) {
    const region = options.region ?? 'na'
    const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis)
    if (!fetchImpl) {
      throw new TypeError(
        'No fetch implementation found. Use Node 20+, or pass options.fetch explicitly.',
      )
    }

    this.store =
      options.tokenStore ??
      new MemoryTokenStore(
        options.tokens ??
          (options.accessToken
            ? { accessToken: options.accessToken, expiresAt: Number.POSITIVE_INFINITY }
            : undefined),
      )

    this.oauth = new OAuthClient(
      {
        clientId: options.clientId ?? '',
        ...(options.clientSecret !== undefined ? { clientSecret: options.clientSecret } : {}),
        ...(options.redirectUri !== undefined ? { redirectUri: options.redirectUri } : {}),
        region,
      },
      { fetch: fetchImpl, store: this.store },
    )

    // Timeout, retry, and observability settings are shared by every
    // transport; only the base URL and credential differ per product.
    const transport = {
      fetch: fetchImpl,
      timeoutMs: options.timeoutMs ?? 30_000,
      retry: {
        maxRetries: options.retry?.maxRetries ?? 2,
        initialDelayMs: options.retry?.initialDelayMs ?? 500,
        maxDelayMs: options.retry?.maxDelayMs ?? 8_000,
      },
      userAgent: options.userAgent ?? `tesdk/${VERSION}`,
      ...(options.headers !== undefined ? { defaultHeaders: options.headers } : {}),
      ...(options.onRequest !== undefined ? { onRequest: options.onRequest } : {}),
    }

    this.http = new HttpClient({
      ...transport,
      baseUrl: resolveBaseUrl(options.baseUrl ?? region),
      getAuthHeader: async () => {
        const token = await this.oauth.getAccessToken()
        return token ? `Bearer ${token}` : undefined
      },
    })

    // The Charging API is a separate product: a different host, and OCPI's
    // `Token` scheme instead of OAuth Bearer. It therefore gets its own
    // transport, so neither product can send the other's host or credential.
    const ocpiHttp = options.ocpiToken
      ? new HttpClient({
          ...transport,
          baseUrl: resolveBaseUrl(options.ocpiBaseUrl ?? options.baseUrl ?? region),
          getAuthHeader: () => Promise.resolve(`Token ${options.ocpiToken ?? ''}`),
        })
      : this.http

    this.vehicles = new VehiclesResource(this.http)
    this.commands = new CommandsResource(this.http)
    this.energy = new EnergyResource(this.http)
    this.user = new UserResource(this.http)
    this.charging = new ChargingResource(this.http)
    this.partner = new PartnerResource(this.http)
    this.fleet = new FleetResource(this.http)
    this.telemetry = new TelemetryResource(this.http)
    this.ocpi = new OcpiResource(ocpiHttp)
  }

  /** Base URL that requests are sent to. */
  get baseUrl(): string {
    return this.http.baseUrl
  }

  /** Replaces the stored credentials, for example after a fresh login. */
  async setTokens(tokens: TokenSet): Promise<void> {
    await this.store.set(tokens)
  }

  /** Returns the stored credentials, if any. */
  async getTokens(): Promise<TokenSet | undefined> {
    return await this.store.get()
  }

  /**
   * Returns a client bound to the region Tesla assigns to this account.
   *
   * Requests to the wrong regional host fail, so this resolves the correct one
   * when it is not known ahead of time.
   *
   * @example
   * ```ts
   * const client = await new TeslaClient({ accessToken }).forUserRegion()
   * ```
   */
  async forUserRegion(options: TeslaClientOptions = {}): Promise<TeslaClient> {
    const { fleet_api_base_url: baseUrl } = await this.user.region()
    if (baseUrl === this.baseUrl) return this
    return new TeslaClient({ ...options, baseUrl, tokenStore: this.store })
  }
}
