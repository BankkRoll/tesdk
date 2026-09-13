/**
 * @file Display formatting for vehicle data.
 *
 * Fleet API mixes absent fields (`undefined`) with fields the vehicle reported
 * as unknown (`null`), and both must render as a dash rather than as "null".
 * Centralising that here keeps the check out of every component.
 */

/** Miles per kilometre, for the metric equivalent shown next to range. */
const KM_PER_MILE = 1.60934

/** Placeholder for a value the vehicle did not report. */
const ABSENT = '—'

/**
 * Formats a range in Tesla's miles alongside its metric equivalent.
 *
 * @param miles - Estimated range, or `undefined` when unreported.
 * @returns For example `231 mi · 372 km`.
 */
export function formatRange(miles: number | undefined): string {
  if (miles === undefined) return ABSENT
  return `${Math.round(miles)} mi · ${Math.round(miles * KM_PER_MILE)} km`
}

/**
 * Formats a temperature reported in Celsius.
 *
 * @param celsius - Reading, `null` when the sensor is unavailable.
 */
export function formatTemp(celsius: number | null | undefined): string {
  if (celsius === null || celsius === undefined) return ABSENT
  return `${celsius.toFixed(1)}°C`
}

/**
 * Formats a percentage.
 *
 * @param value - Whole-number percentage, or `undefined` when unreported.
 */
export function formatPercent(value: number | undefined): string {
  return value === undefined ? ABSENT : `${value}%`
}

/**
 * Formats a charging power reading.
 *
 * @param kilowatts - Power draw, or `undefined` when not charging.
 */
export function formatPower(kilowatts: number | undefined): string {
  return kilowatts === undefined ? ABSENT : `${kilowatts} kW`
}

/**
 * Formats the minutes remaining on a charge as hours and minutes.
 *
 * @param minutes - Remaining time; `0` means the vehicle is not charging.
 * @returns For example `1h 25m`, or a dash when nothing is scheduled.
 */
export function formatDuration(minutes: number | undefined): string {
  if (minutes === undefined || minutes <= 0) return ABSENT
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`
}
