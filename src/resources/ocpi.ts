/**
 * @file Tesla Charging API (OCPI 2.2.1).
 *
 * A product distinct from the Fleet API charging endpoints under
 * `client.charging`. Where those return an account's own charging history,
 * this exposes Tesla's public charging network as a CPO: Locations, EVSEs,
 * Connectors, and Tariffs.
 *
 * Authentication is OCPI's `Token` scheme rather than OAuth Bearer, and access
 * begins with a credentials handshake started from the Tesla developer portal.
 * Tesla extends the OCPI schema with additional fields, so unknown properties
 * should be ignored rather than treated as errors.
 *
 * @see {@link https://github.com/ocpi/ocpi}
 */

import type { RequestOptions } from '../core/http.js'
import type { RequestOverrides } from '../types/common.js'
import { BaseResource } from './base.js'

/** Geographic position in decimal degrees, sent as strings per OCPI. */
export interface GeoLocation {
  latitude: string
  longitude: string
}

/** Physical connector on an EVSE. */
export interface Connector {
  id: string
  /** Connector standard, such as `IEC_62196_T2` or `TESLA_S`. */
  standard: string
  format: 'SOCKET' | 'CABLE' | (string & {})
  power_type: 'AC_1_PHASE' | 'AC_3_PHASE' | 'DC' | (string & {})
  max_voltage?: number
  max_amperage?: number
  /** Rated power delivery in watts. */
  max_electric_power?: number
  /** Tariffs applying to this connector, resolved via {@link OcpiResource.tariffs}. */
  tariff_ids?: string[]
  last_updated?: string
  [key: string]: unknown
}

/** A single charging point within a location. */
export interface Evse {
  uid: string
  evse_id?: string
  /** Real-time availability in OCPI terms. */
  status: 'AVAILABLE' | 'CHARGING' | 'OUTOFORDER' | 'INOPERATIVE' | 'PLANNED' | (string & {})
  connectors: Connector[]
  /** Supported payment and access methods. */
  capabilities?: string[]
  physical_reference?: string
  last_updated?: string
  [key: string]: unknown
}

/** A charging site containing one or more EVSEs. */
export interface Location {
  id: string
  name?: string
  address: string
  city: string
  state?: string
  postal_code?: string
  country: string
  coordinates: GeoLocation
  evses?: Evse[]
  /** Tesla extension: number of charging ports at the site. */
  evse_count?: number
  /** Tesla extension: whether the site is public or restricted. */
  access_type?: string
  operator?: { name: string; [key: string]: unknown }
  party_id?: string
  country_code?: string
  opening_times?: Record<string, unknown>
  time_zone?: string
  last_updated?: string
  [key: string]: unknown
}

/** A price component within a tariff element. */
export interface PriceComponent {
  /**
   * Dimension being charged.
   *
   * Tesla extends OCPI with `CONGESTION_TIME`, which bills time spent charging
   * past a state-of-charge threshold.
   */
  type: 'ENERGY' | 'FLAT' | 'PARKING_TIME' | 'TIME' | 'CONGESTION_TIME' | (string & {})
  price: number
  vat?: number
  /** Billing increment for this dimension. */
  step_size: number
}

/** Conditions under which a tariff element applies. */
export interface TariffRestrictions {
  start_time?: string
  end_time?: string
  min_kwh?: number
  max_kwh?: number
  min_power?: number
  max_power?: number
  day_of_week?: string[]
  /** Tesla extension: applies from this vehicle state of charge, as a percent. */
  min_vehicle_soc?: number
  /** Tesla extension: congestion fees apply from this site threshold, as a percent. */
  min_congestion_threshold?: number
  [key: string]: unknown
}

/** One set of price components with their restrictions. */
export interface TariffElement {
  price_components: PriceComponent[]
  restrictions?: TariffRestrictions
}

/** Pricing applied to a connector. */
export interface Tariff {
  id: string
  currency: string
  country_code?: string
  party_id?: string
  elements: TariffElement[]
  start_date_time?: string
  end_date_time?: string
  last_updated?: string
  [key: string]: unknown
}

/** A module endpoint advertised by {@link OcpiResource.versionDetails}. */
export interface VersionEndpoint {
  identifier: string
  role?: string
  url: string
}

/** Modules and endpoint URLs exposed for an OCPI version. */
export interface VersionDetails {
  version: string
  endpoints: VersionEndpoint[]
}

/** Credentials exchanged during the OCPI handshake. */
export interface Credentials {
  token: string
  url: string
  roles?: {
    role: string
    party_id: string
    country_code: string
    business_details?: { name: string; [key: string]: unknown }
  }[]
  [key: string]: unknown
}

/** OCPI response envelope. */
export interface OcpiResponse<T> {
  data: T
  status_code: number
  status_message?: string
  timestamp?: string
}

/** Offset-based paging accepted by OCPI list endpoints. */
export interface OcpiPageOptions extends RequestOverrides {
  /** Zero-based index of the first record to return. */
  offset?: number
  /** Maximum records to return. */
  limit?: number
  /** Only return records modified at or after this ISO 8601 timestamp. */
  dateFrom?: string
  /** Only return records modified before this ISO 8601 timestamp. */
  dateTo?: string
}

/**
 * Tesla Charging API (OCPI 2.2.1) endpoints.
 *
 * Accessed as `client.ocpi`. Requires a client constructed with an OCPI token
 * and the OCPI base URL supplied by Tesla during the credentials handshake.
 *
 * @example
 * ```ts
 * const client = new TeslaClient({
 *   baseUrl: 'https://ocpi.tesla.com',
 *   ocpiToken: process.env.TESLA_OCPI_TOKEN,
 * })
 * const locations = await client.ocpi.locations({ limit: 100 })
 * ```
 */
export class OcpiResource extends BaseResource {
  /**
   * Lists charging locations visible to the configured scope.
   *
   * Results are paged; combine `offset` and `limit`, or use
   * {@link listAllLocations} to iterate.
   */
  async locations(options: OcpiPageOptions = {}): Promise<Location[]> {
    const { offset, limit, dateFrom, dateTo, ...overrides } = options
    return await this.unwrapOcpi<Location[]>({
      method: 'GET',
      path: '/ocpi/cpo/2.2.1/locations',
      query: { offset, limit, date_from: dateFrom, date_to: dateTo },
      ...overrides,
    })
  }

  /** Retrieves a single location by its identifier. */
  async location(locationId: string, options: RequestOverrides = {}): Promise<Location> {
    return await this.unwrapOcpi<Location>({
      method: 'GET',
      path: `/ocpi/cpo/2.2.1/locations/${encodeURIComponent(locationId)}`,
      ...options,
    })
  }

  /**
   * Iterates every location, requesting pages lazily.
   *
   * @param options - Paging controls; `limit` sets the page size.
   */
  async *listAllLocations(
    options: OcpiPageOptions = {},
  ): AsyncGenerator<Location, void, undefined> {
    const { limit = 100, ...rest } = options
    for (let offset = 0; ; offset += limit) {
      const page = await this.locations({ ...rest, offset, limit })
      yield* page
      if (page.length < limit) return
    }
  }

  /** Lists effective tariffs, which connectors reference by `tariff_ids`. */
  async tariffs(options: OcpiPageOptions = {}): Promise<Tariff[]> {
    const { offset, limit, dateFrom, dateTo, ...overrides } = options
    return await this.unwrapOcpi<Tariff[]>({
      method: 'GET',
      path: '/ocpi/cpo/2.2.1/tariffs',
      query: { offset, limit, date_from: dateFrom, date_to: dateTo },
      ...overrides,
    })
  }

  /** Returns the OCPI modules and endpoint URLs exposed by the platform. */
  async versionDetails(options: RequestOverrides = {}): Promise<VersionDetails> {
    return await this.unwrapOcpi<VersionDetails>({
      method: 'GET',
      path: '/ocpi/cpo/2.2.1',
      ...options,
    })
  }

  /**
   * Returns the credentials currently registered for this connection.
   *
   * Part of the OCPI credentials handshake, which is initiated from the Tesla
   * developer portal with a `CREDENTIALS_TOKEN_A`.
   */
  async credentials(options: RequestOverrides = {}): Promise<Credentials> {
    return await this.unwrapOcpi<Credentials>({
      method: 'GET',
      path: '/ocpi/2.2.1/credentials',
      ...options,
    })
  }

  /**
   * Unwraps the OCPI envelope, which nests the payload under `data` rather
   * than the Fleet API's `response`.
   */
  private async unwrapOcpi<T>(options: RequestOptions): Promise<T> {
    const body = await this.http.request<OcpiResponse<T>>(options)
    return body.data
  }
}
