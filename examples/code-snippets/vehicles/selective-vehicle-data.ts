/**
 * @file Requesting only the `vehicle_data` subtrees you actually read.
 *
 * Prerequisites: a token with `vehicle_device_data`, plus `vehicle_location`
 * for the `location_data` subtree.
 */

import { TeslaClient, type ChargeState, type DriveState, type VehicleData } from 'tesdk'

/**
 * Fetches just the charge state.
 *
 * Narrowing `endpoints` shrinks the payload and shortens how long the vehicle
 * stays awake afterwards, which matters more than the bytes: a vehicle kept
 * awake by polling loses meaningful range overnight.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @throws {VehicleAsleepError} When the vehicle is asleep.
 */
export async function chargeState(client: TeslaClient, vin: string): Promise<ChargeState> {
  const data = await client.vehicles.data(vin, { endpoints: ['charge_state'] })
  if (!data.charge_state) {
    throw new Error(`Vehicle ${vin} returned no charge_state subtree.`)
  }
  return data.charge_state
}

/**
 * Fetches location, which needs two subtrees rather than one.
 *
 * `drive_state` carries the coordinate fields, but they are populated only when
 * `location_data` is also requested and the token holds `vehicle_location`.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @returns Latitude and longitude, or `undefined` when the scope is missing.
 */
export async function currentLocation(
  client: TeslaClient,
  vin: string,
): Promise<{ latitude: number; longitude: number } | undefined> {
  const data = await client.vehicles.data(vin, { endpoints: ['drive_state', 'location_data'] })
  const drive: DriveState | undefined = data.drive_state
  if (drive?.latitude === undefined || drive.longitude === undefined) return undefined
  return { latitude: drive.latitude, longitude: drive.longitude }
}

/**
 * Fetches the subtrees a status dashboard renders, and nothing else.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function dashboardSnapshot(client: TeslaClient, vin: string): Promise<VehicleData> {
  return await client.vehicles.data(vin, {
    endpoints: ['charge_state', 'climate_state', 'vehicle_state'],
  })
}
