/**
 * @file Reading back, diagnosing, and removing a telemetry configuration.
 *
 * Prerequisites: a token with `vehicle_device_data`. Deleting across a whole
 * fleet needs a partner token; a third-party token can only clear vehicles it
 * has access to.
 */

import { TeslaClient, type FleetTelemetryError, type TelemetryConfigStatus } from '@bankkroll/tesdk'

/** Where a vehicle stands relative to its target configuration. */
export interface ConfigState {
  vin: string
  /** Whether the vehicle has adopted the configuration Tesla holds for it. */
  synced: boolean
  /** Whether the vehicle is already at its five-application limit. */
  limitReached: boolean
  /** Fields the vehicle is currently streaming. */
  fields: string[]
}

/**
 * Reads a vehicle's current configuration and sync state.
 *
 * `synced: false` is normal right after a write — the vehicle picks the
 * configuration up on its next connection — but a vehicle stuck unsynced for
 * hours usually has no virtual key or cannot reach the server.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function configState(client: TeslaClient, vin: string): Promise<ConfigState> {
  const status: TelemetryConfigStatus = await client.telemetry.getConfig(vin)

  return {
    vin,
    synced: status.synced === true,
    limitReached: status.limit_reached === true,
    fields: Object.keys(status.config?.fields ?? {}),
  }
}

/**
 * Returns the vehicles that have not adopted their configuration.
 *
 * @param client - Authenticated client.
 * @param vins - Vehicles to check.
 */
export async function unsyncedVehicles(client: TeslaClient, vins: string[]): Promise<ConfigState[]> {
  const states = await Promise.all(vins.map((vin) => configState(client, vin)))
  return states.filter((state) => !state.synced)
}

/**
 * Reads the errors a vehicle reported after receiving a configuration.
 *
 * The first place to look when a vehicle stays unsynced: the vehicle reports a
 * TLS or hostname failure here rather than anywhere in the write path.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function telemetryErrors(
  client: TeslaClient,
  vin: string,
): Promise<FleetTelemetryError[]> {
  return await client.telemetry.errors(vin)
}

/**
 * Reads telemetry errors across every configured vehicle.
 *
 * Requires a partner token. Cheaper than a per-VIN sweep when the question is
 * "is anything broken" rather than "is this vehicle broken".
 *
 * @param partnerClient - Client holding a partner token.
 */
export async function fleetWideErrors(partnerClient: TeslaClient): Promise<FleetTelemetryError[]> {
  return await partnerClient.partner.fleetTelemetryErrors()
}

/**
 * Removes this application's configuration from a vehicle.
 *
 * Do this when a user disconnects: a configuration left in place keeps the
 * vehicle connecting to a server that no longer wants its data, and consumes
 * one of the vehicle's five slots.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function stopStreaming(client: TeslaClient, vin: string): Promise<void> {
  await client.telemetry.deleteConfig(vin)
}
