/**
 * @file Partner account registration and telemetry diagnostics.
 *
 * @see {@link https://developer.tesla.com/docs/fleet-api/endpoints/partner-endpoints}
 */

import type { RequestOverrides } from '../types/common.js'
import { BaseResource } from './base.js'

/** Partner account record returned by {@link PartnerResource.register}. */
export interface PartnerAccount {
  account_id?: string
  domain?: string
  name?: string
  description?: string
  client_id?: string
  ca?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

/** Public key registered for a domain. */
export interface PartnerPublicKey {
  /** PEM-encoded secp256r1 public key. */
  public_key?: string
  [key: string]: unknown
}

/** A telemetry error reported by a vehicle after receiving a configuration. */
export interface FleetTelemetryError {
  vin?: string
  name?: string
  error?: string
  timestamp?: string
  [key: string]: unknown
}

/**
 * Partner account endpoints.
 *
 * Accessed as `client.partner`. Every endpoint here requires a partner token
 * obtained through the `client_credentials` grant; a third-party user token is
 * rejected.
 *
 * @see {@link https://developer.tesla.com/docs/fleet-api/endpoints/partner-endpoints}
 */
export class PartnerResource extends BaseResource {
  /**
   * Registers the application in the current region.
   *
   * Must be completed once per region before third-party tokens issued for
   * that region are accepted. Before calling, a PEM-encoded secp256r1 public
   * key must be reachable at {@link PUBLIC_KEY_PATH} on the application
   * domain, and must remain hosted there for pairing to keep working.
   *
   * @param domain - Domain hosting the public key. Must share a root domain
   * with an allowed origin configured on developer.tesla.com, and is shown to
   * users during virtual key pairing.
   */
  async register(domain: string, options: RequestOverrides = {}): Promise<PartnerAccount> {
    return await this.unwrap<PartnerAccount>({
      method: 'POST',
      path: '/api/1/partner_accounts',
      body: { domain },
      idempotent: true,
      ...options,
    })
  }

  /**
   * Returns the public key registered for a domain.
   *
   * A successful response confirms that {@link register} completed.
   *
   * @param domain - Domain to look up. Defaults to the registered domain.
   */
  async publicKey(domain?: string, options: RequestOverrides = {}): Promise<PartnerPublicKey> {
    return await this.unwrap<PartnerPublicKey>({
      method: 'GET',
      path: '/api/1/partner_accounts/public_key',
      query: { domain },
      ...options,
    })
  }

  /** Returns recent telemetry errors reported by configured vehicles. */
  async fleetTelemetryErrors(options: RequestOverrides = {}): Promise<FleetTelemetryError[]> {
    return await this.unwrap<FleetTelemetryError[]>({
      method: 'GET',
      path: '/api/1/partner_accounts/fleet_telemetry_errors',
      ...options,
    })
  }

  /** Returns the VINs that reported a telemetry configuration error. */
  async fleetTelemetryErrorVins(options: RequestOverrides = {}): Promise<string[]> {
    return await this.unwrap<string[]>({
      method: 'GET',
      path: '/api/1/partner_accounts/fleet_telemetry_error_vins',
      ...options,
    })
  }
}
