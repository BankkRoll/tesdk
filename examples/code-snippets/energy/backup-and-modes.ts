/**
 * @file Backup reserve, operation mode, storm mode, and grid export rules.
 *
 * Prerequisites: a token with `energy_cmds`.
 */

import { TeslaClient, type EnergyCommandResult, type SiteOperationMode } from '@bankkroll/tesdk'

/**
 * Sets the charge held back for grid outages.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param percent - Reserve level from 0 to 100.
 * @throws {RangeError} When the percentage is out of range.
 */
export async function setBackupReserve(
  client: TeslaClient,
  siteId: number,
  percent: number,
): Promise<EnergyCommandResult> {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`Backup reserve must be an integer from 0 to 100 (received ${percent}).`)
  }
  return await client.energy.setBackupReserve(siteId, percent)
}

/**
 * Sets how the site decides when to use the battery.
 *
 * `self_consumption` stores solar for the house, `autonomous` lets Tesla
 * arbitrage against the time-of-use tariff, and `backup` holds the battery full
 * for outages.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param mode - Operating mode.
 */
export async function setOperationMode(
  client: TeslaClient,
  siteId: number,
  mode: SiteOperationMode,
): Promise<EnergyCommandResult> {
  return await client.energy.setOperationMode(siteId, mode)
}

/**
 * Turns Storm Watch on or off.
 *
 * With it on, Tesla charges the battery to full ahead of forecast severe
 * weather, overriding the reserve until the alert clears.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param enabled - Desired state.
 */
export async function setStormMode(
  client: TeslaClient,
  siteId: number,
  enabled: boolean,
): Promise<EnergyCommandResult> {
  return await client.energy.setStormMode(siteId, enabled)
}

/**
 * Configures the site for an outage: hold the battery, and keep some for the car.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param vehicleReservePercent - Share of the battery vehicle charging may draw
 * on while off-grid.
 */
export async function prepareForOutage(
  client: TeslaClient,
  siteId: number,
  vehicleReservePercent: number,
): Promise<void> {
  await client.energy.setOperationMode(siteId, 'backup')
  await client.energy.setBackupReserve(siteId, 100)
  await client.energy.setOffGridVehicleChargingReserve(siteId, vehicleReservePercent)
}

/**
 * Stops the site exporting to the grid while allowing solar to charge the house.
 *
 * The right setting where a utility does not compensate exports, or penalizes
 * them.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 */
export async function disableGridExport(
  client: TeslaClient,
  siteId: number,
): Promise<EnergyCommandResult> {
  return await client.energy.setGridImportExport(siteId, {
    customer_preferred_export_rule: 'never',
  })
}
