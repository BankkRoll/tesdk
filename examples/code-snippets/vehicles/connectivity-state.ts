/**
 * @file Checking whether a vehicle is reachable without waking it.
 *
 * Prerequisites: a token with `vehicle_device_data`.
 */

import { TeslaClient, type Vehicle, type VehicleState } from 'tesdk'

/**
 * Returns a vehicle's connectivity state.
 *
 * `get` is the cheapest reachability check there is: it reads Tesla's cached
 * record rather than contacting the vehicle, so it neither wakes it nor counts
 * against the billable `vehicle_data` allowance.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function connectivityState(client: TeslaClient, vin: string): Promise<VehicleState> {
  const { state } = await client.vehicles.get(vin)
  return state
}

/**
 * Splits a fleet into vehicles that will answer now and those that would need
 * waking.
 *
 * Uses the list endpoint rather than a `get` per VIN, so the whole fleet costs
 * one request.
 *
 * @param client - Authenticated client.
 * @returns Online vehicles and the rest, partitioned.
 */
export async function partitionByReachability(
  client: TeslaClient,
): Promise<{ online: Vehicle[]; sleeping: Vehicle[] }> {
  const online: Vehicle[] = []
  const sleeping: Vehicle[] = []

  for await (const vehicle of client.vehicles.listAll()) {
    ;(vehicle.state === 'online' ? online : sleeping).push(vehicle)
  }

  return { online, sleeping }
}
