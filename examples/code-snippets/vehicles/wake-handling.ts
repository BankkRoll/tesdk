/**
 * @file Waking a vehicle: eagerly, lazily, and not at all.
 *
 * Prerequisites: a token with `vehicle_device_data` and `vehicle_cmds`.
 */

import { TeslaClient, TimeoutError, VehicleAsleepError, type VehicleData } from '@bankkroll/tesdk'

/**
 * Wakes the vehicle up front, then reads it.
 *
 * Right when you know the read must succeed — a user pressed refresh — and the
 * 10-to-60-second wait is acceptable. `ensureAwake` returns immediately if the
 * vehicle is already online, so the check costs one cheap request.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @throws {TimeoutError} When the vehicle does not report `online` in time.
 */
export async function readAfterWake(client: TeslaClient, vin: string): Promise<VehicleData> {
  await client.vehicles.ensureAwake(vin, { maxWaitMs: 90_000, pollIntervalMs: 3_000 })
  return await client.vehicles.data(vin, { endpoints: ['charge_state'] })
}

/**
 * Reads the vehicle, waking it only if the read actually fails.
 *
 * Cheaper than {@link readAfterWake} for a vehicle that is usually online: no
 * pre-flight request, and no wake at all in the common case.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function readWithLazyWake(client: TeslaClient, vin: string): Promise<VehicleData> {
  return await client.vehicles.withWake(vin, () =>
    client.vehicles.data(vin, { endpoints: ['charge_state'] }),
  )
}

/**
 * Reads the vehicle only if it is already awake.
 *
 * The right default for background jobs and dashboards that refresh on a timer:
 * waking a fleet on a schedule drains real range for data nobody is looking at.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @returns The snapshot, or `undefined` when the vehicle is asleep.
 */
export async function readIfAwake(
  client: TeslaClient,
  vin: string,
): Promise<VehicleData | undefined> {
  try {
    return await client.vehicles.data(vin, { endpoints: ['charge_state'] })
  } catch (error) {
    if (error instanceof VehicleAsleepError) return undefined
    throw error
  }
}

/**
 * Wakes a vehicle and reports whether it came online, without throwing.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param maxWaitMs - How long to wait before giving up.
 */
export async function tryWake(
  client: TeslaClient,
  vin: string,
  maxWaitMs = 60_000,
): Promise<boolean> {
  try {
    await client.vehicles.ensureAwake(vin, { maxWaitMs })
    return true
  } catch (error) {
    // A vehicle in an underground garage never wakes; that is an outcome, not
    // an exception worth propagating from a best-effort refresh.
    if (error instanceof TimeoutError) return false
    throw error
  }
}
