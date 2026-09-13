/**
 * @file Charge and precondition schedules.
 *
 * Prerequisites: a token with `vehicle_charging_cmds`, and firmware 2024.26 or
 * later for the `add_charge_schedule` endpoint used here.
 */

import { TeslaClient, type CommandResult } from '@bankkroll/tesdk'

/** A recurring charge window. */
export interface ChargeWindow {
  /** Minutes past midnight when charging should begin. */
  startTimeMinutes: number
  /** Minutes past midnight when charging should end. */
  endTimeMinutes: number
  /** Days the schedule applies to, as a comma-separated list or `All`. */
  daysOfWeek: string
  latitude: number
  longitude: number
}

/**
 * Adds a charge schedule pinned to a location.
 *
 * Schedules are location-aware: the vehicle applies one only when parked near
 * the given coordinates, which is what keeps a home off-peak window from
 * following the car to a Supercharger.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param window - Times, days, and the location the schedule applies at.
 * @returns The command result, whose body carries the assigned schedule id.
 *
 * @example
 * ```ts
 * // Charge between 00:30 and 06:00 on weeknights at home.
 * await addChargeSchedule(client, vin, {
 *   startTimeMinutes: 30,
 *   endTimeMinutes: 360,
 *   daysOfWeek: 'Mon,Tues,Wed,Thurs,Fri',
 *   latitude: 37.7749,
 *   longitude: -122.4194,
 * })
 * ```
 */
export async function addChargeSchedule(
  client: TeslaClient,
  vin: string,
  window: ChargeWindow,
): Promise<CommandResult> {
  return await client.commands.addChargeSchedule(vin, {
    days_of_week: window.daysOfWeek,
    enabled: true,
    start_enabled: true,
    end_enabled: true,
    start_time: window.startTimeMinutes,
    end_time: window.endTimeMinutes,
    lat: window.latitude,
    lon: window.longitude,
    one_time: false,
  })
}

/** Removes a charge schedule by the id the vehicle assigned it. */
export async function removeChargeSchedule(
  client: TeslaClient,
  vin: string,
  id: number,
): Promise<CommandResult> {
  return await client.commands.removeChargeSchedule(vin, id)
}

/**
 * Adds a departure preconditioning schedule.
 *
 * `precondition_time` is when the cabin should be ready, not when conditioning
 * starts — the vehicle works backwards from it.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param readyAtMinutes - Minutes past midnight the vehicle should be ready.
 * @param daysOfWeek - Days the schedule applies to.
 * @param position - Location the schedule applies at.
 */
export async function addPreconditionSchedule(
  client: TeslaClient,
  vin: string,
  readyAtMinutes: number,
  daysOfWeek: string,
  position: { lat: number; lon: number },
): Promise<CommandResult> {
  return await client.commands.addPreconditionSchedule(vin, {
    days_of_week: daysOfWeek,
    enabled: true,
    precondition_time: readyAtMinutes,
    lat: position.lat,
    lon: position.lon,
    one_time: false,
  })
}

/**
 * Replaces a schedule, since the endpoint has no update operation.
 *
 * Removing first is deliberate: adding a second overlapping window leaves the
 * vehicle honouring both, which reads as the old schedule never having been
 * replaced.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param id - Existing schedule to drop.
 * @param window - Replacement window.
 */
export async function replaceChargeSchedule(
  client: TeslaClient,
  vin: string,
  id: number,
  window: ChargeWindow,
): Promise<CommandResult> {
  await client.commands.removeChargeSchedule(vin, id)
  return await addChargeSchedule(client, vin, window)
}
