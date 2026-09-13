/**
 * @file Reading an energy site's configuration.
 *
 * Prerequisites: a token with `energy_device_data`.
 */

import { TeslaClient, type EnergySiteInfo, type SiteOperationMode } from '@bankkroll/tesdk'

/** The settings worth surfacing before changing anything. */
export interface SiteSettings {
  name: string | undefined
  backupReservePercent: number | undefined
  operationMode: SiteOperationMode | undefined
  firmwareVersion: string | undefined
  installedOn: string | undefined
}

/**
 * Reads a site's current configuration.
 *
 * Worth calling before any setting change: the write endpoints replace a value
 * outright, so the only way to make a relative adjustment is to read first.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 */
export async function siteSettings(client: TeslaClient, siteId: number): Promise<SiteSettings> {
  const info: EnergySiteInfo = await client.energy.siteInfo(siteId)

  return {
    name: info.site_name,
    backupReservePercent: info.backup_reserve_percent,
    operationMode: info.default_real_mode,
    firmwareVersion: info.version,
    installedOn: info.installation_date,
  }
}

/**
 * Nudges the backup reserve by a relative amount.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param deltaPercent - Points to add, negative to subtract.
 * @returns The reserve that was applied, clamped to 0-100.
 */
export async function adjustBackupReserve(
  client: TeslaClient,
  siteId: number,
  deltaPercent: number,
): Promise<number> {
  const { backup_reserve_percent: current } = await client.energy.siteInfo(siteId)
  const target = Math.min(100, Math.max(0, (current ?? 0) + deltaPercent))

  await client.energy.setBackupReserve(siteId, target)
  return target
}
