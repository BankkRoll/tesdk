/**
 * @file Reading real-time power flow at an energy site.
 *
 * Prerequisites: a token with `energy_device_data`.
 */

import { TeslaClient, type EnergySiteLiveStatus } from '@bankkroll/tesdk'

/** Instantaneous power flow, in watts, with signs normalized. */
export interface PowerFlow {
  /** Solar generation. Never negative. */
  solar: number
  /** Household consumption. */
  load: number
  /** Positive while discharging the battery, negative while charging it. */
  battery: number
  /** Positive while importing from the grid, negative while exporting. */
  grid: number
  /** Battery state of charge, as a percentage. */
  stateOfCharge: number
  gridUp: boolean
}

/**
 * Reads and normalizes a site's current power flow.
 *
 * Tesla omits fields a site does not have — no solar, no `solar_power` — so
 * every value is defaulted rather than assumed present.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 */
export async function powerFlow(client: TeslaClient, siteId: number): Promise<PowerFlow> {
  const status: EnergySiteLiveStatus = await client.energy.liveStatus(siteId)

  return {
    solar: status.solar_power ?? 0,
    load: status.load_power ?? 0,
    battery: status.battery_power ?? 0,
    grid: status.grid_power ?? 0,
    stateOfCharge: status.percentage_charged ?? 0,
    gridUp: status.grid_status !== 'Inactive',
  }
}

/**
 * Reports whether the site is currently running off-grid.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 */
export async function isOnBackupPower(client: TeslaClient, siteId: number): Promise<boolean> {
  const { gridUp } = await powerFlow(client, siteId)
  return !gridUp
}

/**
 * Estimates how long the battery can carry the current load.
 *
 * Only meaningful during an outage: while the grid is up the battery may be
 * charging, in which case the load is not coming from it at all.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @returns Hours of runtime, or `undefined` when the battery is not discharging.
 */
export async function hoursOfBackupLeft(
  client: TeslaClient,
  siteId: number,
): Promise<number | undefined> {
  const status = await client.energy.liveStatus(siteId)
  const remainingWh = status.energy_left
  const drawW = status.battery_power

  if (remainingWh === undefined || drawW === undefined || drawW <= 0) return undefined
  return remainingWh / drawW
}
