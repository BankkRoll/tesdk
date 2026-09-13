/**
 * @file Listing vehicles: one page, every page, and stopping early.
 *
 * Prerequisites: a token with `vehicle_device_data`.
 */

import { TeslaClient, type Vehicle } from 'tesdk'

/**
 * Fetches a single page.
 *
 * Enough for the overwhelming majority of accounts, which own fewer vehicles
 * than the 100-item default page size.
 *
 * @param client - Authenticated client.
 * @returns The first page of vehicles.
 */
export async function firstPage(client: TeslaClient): Promise<Vehicle[]> {
  return await client.vehicles.list()
}

/**
 * Fetches one explicit page of a known size.
 *
 * @param client - Authenticated client.
 * @param page - 1-based page number.
 * @param perPage - Items per page.
 */
export async function explicitPage(
  client: TeslaClient,
  page: number,
  perPage: number,
): Promise<Vehicle[]> {
  return await client.vehicles.list({ page, perPage })
}

/**
 * Collects an entire fleet, letting `listAll` request pages lazily.
 *
 * @param client - Authenticated client.
 * @returns Every vehicle on the account.
 */
export async function everyVehicle(client: TeslaClient): Promise<Vehicle[]> {
  const vehicles: Vehicle[] = []
  for await (const vehicle of client.vehicles.listAll({ perPage: 50 })) {
    vehicles.push(vehicle)
  }
  return vehicles
}

/**
 * Finds the first vehicle matching a predicate without draining the fleet.
 *
 * Breaking out of a `for await` closes the generator, so no further pages are
 * requested — the reason to prefer `listAll` over collecting everything first.
 *
 * @param client - Authenticated client.
 * @param predicate - Test applied to each vehicle as it arrives.
 * @returns The first match, or `undefined` when none matched.
 */
export async function findVehicle(
  client: TeslaClient,
  predicate: (vehicle: Vehicle) => boolean,
): Promise<Vehicle | undefined> {
  for await (const vehicle of client.vehicles.listAll()) {
    if (predicate(vehicle)) return vehicle
  }
  return undefined
}
