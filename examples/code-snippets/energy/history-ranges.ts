/**
 * @file Energy, backup, and Wall Connector history over explicit date ranges.
 *
 * Prerequisites: a token with `energy_device_data`.
 */

import { TeslaClient, type EnergyHistory, type HistoryPeriod } from '@bankkroll/tesdk'

/**
 * Fetches energy history for a calendar range.
 *
 * `timeZone` is what aligns the buckets: without it, a "day" is cut at UTC
 * midnight rather than the site's, and the totals disagree with the Tesla app
 * by however many hours the site is offset.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param period - Bucket size.
 * @param range - ISO 8601 bounds and the site's IANA time zone.
 * @returns Buckets whose energy values are in watt-hours.
 */
export async function energyHistory(
  client: TeslaClient,
  siteId: number,
  period: HistoryPeriod,
  range: { startDate: string; endDate: string; timeZone: string },
): Promise<EnergyHistory> {
  return await client.energy.energyHistory(siteId, period, range)
}

/**
 * Fetches the last full calendar month of daily buckets.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param timeZone - Site's IANA time zone, from {@link TeslaClient.energy}'s
 * `siteInfo` or the history response's `installation_time_zone`.
 */
export async function lastMonthDaily(
  client: TeslaClient,
  siteId: number,
  timeZone: string,
): Promise<EnergyHistory> {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))

  return await client.energy.energyHistory(siteId, 'day', {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    timeZone,
  })
}

/**
 * Fetches grid outage events for a year.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param timeZone - Site's IANA time zone.
 * @returns Buckets whose durations are in seconds.
 */
export async function outageHistory(
  client: TeslaClient,
  siteId: number,
  timeZone: string,
): Promise<EnergyHistory> {
  return await client.energy.backupHistory(siteId, 'year', { timeZone })
}

/**
 * Fetches Wall Connector charging history.
 *
 * This endpoint takes no `period` — it returns per-session rows rather than
 * aggregated buckets — so the range is the only control you have over its size.
 *
 * @param client - Authenticated client.
 * @param siteId - Energy site identifier.
 * @param range - ISO 8601 bounds and the site's IANA time zone.
 */
export async function wallConnectorHistory(
  client: TeslaClient,
  siteId: number,
  range: { startDate: string; endDate: string; timeZone: string },
): Promise<EnergyHistory> {
  return await client.energy.chargeHistory(siteId, range)
}

/**
 * Sums one measurement across every bucket in a series.
 *
 * History entries carry an index signature because the field set varies by
 * hardware, so the value is checked at runtime rather than assumed numeric.
 *
 * @param history - A series from any of the history endpoints.
 * @param field - Field to total, such as `solar_energy_exported`.
 * @returns The total in watt-hours.
 */
export function totalWattHours(history: EnergyHistory, field: string): number {
  return (history.time_series ?? []).reduce((sum, entry) => {
    const value = entry[field]
    return typeof value === 'number' ? sum + value : sum
  }, 0)
}
