/**
 * @file Fleet Telemetry configuration.
 *
 * Fleet Telemetry streams vehicle data to a self-hosted server instead of
 * polling `vehicle_data`, which avoids waking the vehicle and is substantially
 * cheaper. Configuration must be signed, so
 * {@link TelemetryResource.createConfig} is normally called through a Vehicle
 * Command Proxy, which signs the payload with the application private key.
 *
 * @see {@link https://github.com/teslamotors/fleet-telemetry}
 */

import type { RequestOverrides } from '../types/common.js'
import { BaseResource, assertVin } from './base.js'
import type { FleetTelemetryError } from './partner.js'

/**
 * Per-field streaming rules.
 *
 * A value is sent only once `interval_seconds` has elapsed since its last
 * emission and the value has actually changed, so a short interval does not by
 * itself increase traffic for a stable signal.
 */
export interface TelemetryFieldConfig {
  /** Minimum seconds between emissions of this field. */
  interval_seconds: number
  /**
   * Minimum change required before the field is re-sent. Location deltas are
   * measured in meters. Requires firmware 2025.2.6 or later.
   */
  minimum_delta?: number
  /**
   * Fields to include in the same payload whenever this field publishes, even
   * if their own value has not changed. Requires Fleet Telemetry client 1.3.0.
   */
  include_fields?: string[]
}

/** Telemetry configuration applied to a set of vehicles. */
export interface TelemetryConfig {
  /** Hostname and port of the self-hosted Fleet Telemetry server. */
  hostname: string
  /** PEM-encoded CA certificate chain that the vehicle validates against. */
  ca: string
  /** Signals to stream, keyed by field name. */
  fields: Record<string, TelemetryFieldConfig>
  /** Seconds before an idle connection is torn down. */
  exp?: number
  /** Port, when not implied by `hostname`. */
  port?: number
  /**
   * Set to `latest` to have the vehicle resend data the server has not
   * acknowledged. Requires Fleet Telemetry server 0.7.1 or later.
   */
  delivery_policy?: 'latest'
  [key: string]: unknown
}

/** Result of applying a configuration to a set of vehicles. */
export interface TelemetryConfigResult {
  updated_vehicles?: number
  /** VINs rejected, keyed by VIN, with a reason such as `missing_key`. */
  skipped_vehicles?: Record<string, unknown>
  [key: string]: unknown
}

/** A vehicle's current telemetry configuration. */
export interface TelemetryConfigStatus {
  /** Whether the vehicle has adopted the target configuration. */
  synced?: boolean
  config?: TelemetryConfig
  /** Whether the vehicle already holds the maximum number of configurations. */
  limit_reached?: boolean
  [key: string]: unknown
}

/**
 * Fleet Telemetry configuration endpoints.
 *
 * Accessed as `client.telemetry`.
 */
export class TelemetryResource extends BaseResource {
  /**
   * Applies a telemetry configuration to a set of vehicles.
   *
   * Send this through a Vehicle Command Proxy so the payload is signed. A
   * vehicle accepts configurations from at most five applications.
   *
   * @param vins - Vehicles to configure.
   * @param config - Server address and the fields to stream.
   *
   * @example
   * ```ts
   * await client.telemetry.createConfig([vin], {
   *   hostname: 'telemetry.example.com',
   *   ca: caPem,
   *   fields: { Soc: { interval_seconds: 60 }, Location: { interval_seconds: 10 } },
   * })
   * ```
   */
  async createConfig(
    vins: string[],
    config: TelemetryConfig,
    options: RequestOverrides = {},
  ): Promise<TelemetryConfigResult> {
    return await this.unwrap<TelemetryConfigResult>({
      method: 'POST',
      path: '/api/1/vehicles/fleet_telemetry_config',
      body: { vins: vins.map(assertVin), config },
      idempotent: true,
      ...options,
    })
  }

  /**
   * Applies a pre-signed configuration token.
   *
   * Prefer {@link createConfig} through the proxy; this endpoint exists for
   * callers that sign the JWS themselves using Schnorr over NIST P-256 and
   * SHA-256.
   */
  async createConfigJws(
    token: string,
    options: RequestOverrides = {},
  ): Promise<TelemetryConfigResult> {
    return await this.unwrap<TelemetryConfigResult>({
      method: 'POST',
      path: '/api/1/vehicles/fleet_telemetry_config_jws',
      body: { token },
      idempotent: true,
      ...options,
    })
  }

  /** Returns a vehicle's telemetry configuration and sync state. */
  async getConfig(vin: string, options: RequestOverrides = {}): Promise<TelemetryConfigStatus> {
    return await this.unwrap<TelemetryConfigStatus>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/fleet_telemetry_config`,
      ...options,
    })
  }

  /**
   * Removes a vehicle's telemetry configuration.
   *
   * A partner token removes the configuration from any vehicle; a third-party
   * token is limited to vehicles it has been granted access to.
   */
  async deleteConfig(vin: string, options: RequestOverrides = {}): Promise<TelemetryConfigResult> {
    return await this.unwrap<TelemetryConfigResult>({
      method: 'DELETE',
      path: `/api/1/vehicles/${assertVin(vin)}/fleet_telemetry_config`,
      idempotent: true,
      ...options,
    })
  }

  /** Returns recent telemetry errors reported by a vehicle. */
  async errors(vin: string, options: RequestOverrides = {}): Promise<FleetTelemetryError[]> {
    return await this.unwrap<FleetTelemetryError[]>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/fleet_telemetry_errors`,
      ...options,
    })
  }
}
