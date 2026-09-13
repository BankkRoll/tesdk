/**
 * @file Sending destinations to the vehicle's navigation system.
 *
 * Prerequisites: a token with `vehicle_cmds`.
 */

import { TeslaClient, type ChargingSite, type CommandResult } from '@bankkroll/tesdk'

/**
 * Navigates to a coordinate pair.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param position - Destination latitude and longitude.
 */
export async function navigateToCoordinates(
  client: TeslaClient,
  vin: string,
  position: { lat: number; lon: number },
): Promise<CommandResult> {
  return await client.commands.navigationGpsRequest(vin, position)
}

/**
 * Navigates to a free-text destination.
 *
 * Accepts anything the mobile app's share sheet would: a street address, a
 * `latitude,longitude` pair, or a maps share URL. The vehicle resolves it, so a
 * value it cannot geocode comes back as `result: false`.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param destination - Address, coordinate pair, or share URL.
 */
export async function navigateToAddress(
  client: TeslaClient,
  vin: string,
  destination: string,
): Promise<CommandResult> {
  return await client.commands.navigationRequest(vin, destination)
}

/**
 * Routes to the nearest Supercharger with a stall free right now.
 *
 * `nearbyChargingSites` is ordered by distance, so the first site with
 * availability is the closest usable one.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @returns The chosen site, or `undefined` when none nearby has a free stall.
 */
export async function navigateToOpenSupercharger(
  client: TeslaClient,
  vin: string,
): Promise<ChargingSite | undefined> {
  const { superchargers = [] } = await client.vehicles.nearbyChargingSites(vin)

  const open = superchargers.find(
    (site) => !site.site_closed && (site.available_stalls ?? 0) > 0 && site.location,
  )
  if (!open?.location) return undefined

  await client.commands.navigationGpsRequest(vin, {
    lat: open.location.lat,
    lon: open.location.long,
  })
  return open
}
