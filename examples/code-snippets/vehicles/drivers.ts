/**
 * @file Listing and revoking the drivers who can access a vehicle.
 *
 * Prerequisites: a token with `vehicle_cmds`, held by the vehicle's owner.
 * Share users can list drivers but may remove only their own access.
 */

import { NotFoundError, PermissionError, TeslaClient, type Driver } from 'tesdk'

/**
 * Lists the drivers permitted to access a vehicle.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function listDrivers(client: TeslaClient, vin: string): Promise<Driver[]> {
  return await client.vehicles.drivers(vin)
}

/**
 * Revokes a driver's access by their display name.
 *
 * @param client - Authenticated client, held by the vehicle owner.
 * @param vin - Vehicle identification number.
 * @param firstName - Driver's first name as it appears in the list.
 * @returns `true` when a driver was removed, `false` when none matched.
 * @throws {PermissionError} When the caller is not the owner.
 */
export async function revokeDriverByName(
  client: TeslaClient,
  vin: string,
  firstName: string,
): Promise<boolean> {
  const drivers = await client.vehicles.drivers(vin)
  const match = drivers.find((driver) => driver.driver_first_name === firstName)

  // `user_id` is the share id the delete endpoint takes; it is absent on the
  // owner's own record, which cannot be revoked.
  if (match?.user_id === undefined) return false

  await client.vehicles.removeDriver(vin, match.user_id)
  return true
}

/**
 * Counts drivers across a fleet, tolerating vehicles the caller cannot inspect.
 *
 * @param client - Authenticated client.
 * @param vins - Vehicles to inspect.
 * @returns Driver counts keyed by VIN, omitting vehicles that were unreadable.
 */
export async function driverCounts(
  client: TeslaClient,
  vins: string[],
): Promise<Record<string, number>> {
  const results = await Promise.all(
    vins.map(async (vin): Promise<[string, number][]> => {
      try {
        return [[vin, (await client.vehicles.drivers(vin)).length]]
      } catch (error) {
        // A shared vehicle the caller does not own, or one removed mid-sweep.
        if (error instanceof PermissionError || error instanceof NotFoundError) return []
        throw error
      }
    }),
  )

  return Object.fromEntries(results.flat())
}
