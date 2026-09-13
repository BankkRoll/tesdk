/**
 * @file Discovering which vehicles require signed commands, and which are
 * paired to this application.
 *
 * Prerequisites: a token with `vehicle_device_data`.
 */

import { TeslaClient, type VehicleFleetInfo } from '@bankkroll/tesdk'

/** What an application needs to know before sending a vehicle a command. */
export interface CommandReadiness {
  vin: string
  /** Whether the vehicle rejects unsigned commands. */
  requiresSigning: boolean
  /** Whether this application's virtual key is installed. */
  keyPaired: boolean
  /** Ready when either signing is not required, or it is and the key is paired. */
  ready: boolean
  firmwareVersion: string | undefined
}

/**
 * Reports command readiness for a batch of VINs.
 *
 * `fleetStatus` is the authoritative source: model year is a bad proxy, since
 * firmware updates have moved the boundary, and a paired key can be removed by
 * the owner at any time.
 *
 * @param client - Authenticated client.
 * @param vins - Vehicles to check, in one request.
 * @returns One entry per requested VIN, in the order given.
 *
 * @example
 * ```ts
 * const blocked = (await commandReadiness(client, vins)).filter((v) => !v.ready)
 * ```
 */
export async function commandReadiness(
  client: TeslaClient,
  vins: string[],
): Promise<CommandReadiness[]> {
  const status = await client.vehicles.fleetStatus(vins)
  const paired = new Set(status.key_paired_vins ?? [])

  return vins.map((vin) => {
    const info: VehicleFleetInfo = status.vehicle_info?.[vin] ?? {}
    const requiresSigning = info.vehicle_command_protocol_required === true
    const keyPaired = paired.has(vin)

    return {
      vin,
      requiresSigning,
      keyPaired,
      ready: !requiresSigning || keyPaired,
      firmwareVersion: info.firmware_version,
    }
  })
}

/**
 * Picks the base URL a command to this vehicle should be sent to.
 *
 * The only change signing requires of calling code: swap the host, keep every
 * call site identical.
 *
 * @param client - Client used for the capability lookup.
 * @param vin - Vehicle identification number.
 * @param proxyUrl - Address of a running Vehicle Command Proxy.
 * @returns A client pointed at the proxy when signing is required, otherwise
 * the client it was given.
 */
export async function clientForCommands(
  client: TeslaClient,
  vin: string,
  proxyUrl: string,
): Promise<TeslaClient> {
  const [readiness] = await commandReadiness(client, [vin])
  if (!readiness?.requiresSigning) return client

  return new TeslaClient({
    baseUrl: proxyUrl,
    tokenStore: { get: () => client.getTokens(), set: (tokens) => client.setTokens(tokens) },
  })
}
