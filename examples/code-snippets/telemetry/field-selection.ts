/**
 * @file Tuning per-field streaming rules: intervals, deltas, and grouping.
 *
 * Prerequisites: firmware 2025.2.6 or later for `minimum_delta`, and Fleet
 * Telemetry client 1.3.0 or later for `include_fields`.
 */

import type { TelemetryFieldConfig } from 'tesdk'

/**
 * Fields for a fleet-tracking application.
 *
 * `interval_seconds` is a floor, not a schedule: a field is sent only once the
 * interval has elapsed *and* its value has changed. A parked vehicle on a
 * ten-second location interval therefore sends nothing at all, so a short
 * interval costs traffic only while something is actually happening.
 */
export const FLEET_TRACKING_FIELDS: Record<string, TelemetryFieldConfig> = {
  // 50 metres of movement is roughly a city block; below that, GPS jitter alone
  // would keep the field publishing while the vehicle sits still.
  Location: { interval_seconds: 10, minimum_delta: 50 },
  VehicleSpeed: { interval_seconds: 10 },
  Odometer: { interval_seconds: 300 },
  Gear: { interval_seconds: 5 },
}

/**
 * Fields for a charging-analytics application.
 *
 * `include_fields` groups signals into one payload: whenever the charging state
 * flips, the state of charge and the charger power ride along even if they have
 * not changed, so each transition arrives as a complete record instead of
 * fields to be joined by timestamp later.
 */
export const CHARGING_ANALYTICS_FIELDS: Record<string, TelemetryFieldConfig> = {
  DetailedChargeState: {
    interval_seconds: 30,
    include_fields: ['Soc', 'ACChargingPower', 'DCChargingPower', 'ChargeLimitSoc'],
  },
  Soc: { interval_seconds: 60, minimum_delta: 1 },
  ACChargingPower: { interval_seconds: 60 },
  DCChargingPower: { interval_seconds: 30 },
}

/**
 * Fields for a low-volume battery-health application.
 *
 * Long intervals plus deltas: this configuration produces a handful of messages
 * a day per vehicle, which is the point.
 */
export const BATTERY_HEALTH_FIELDS: Record<string, TelemetryFieldConfig> = {
  Soc: { interval_seconds: 900, minimum_delta: 2 },
  RatedRange: { interval_seconds: 3600, minimum_delta: 5 },
  ModuleTempMin: { interval_seconds: 900, minimum_delta: 2 },
  ModuleTempMax: { interval_seconds: 900, minimum_delta: 2 },
}

/**
 * Widens every interval in a field set by a factor.
 *
 * The quickest lever when a fleet is producing more messages than the server
 * can keep up with, and it needs no per-field decisions.
 *
 * @param fields - Field set to slow down.
 * @param factor - Multiplier applied to each interval. Must be at least 1.
 * @returns A new field set; the input is not modified.
 *
 * @example
 * ```ts
 * const halfRate = slowDown(FLEET_TRACKING_FIELDS, 2)
 * ```
 */
export function slowDown(
  fields: Record<string, TelemetryFieldConfig>,
  factor: number,
): Record<string, TelemetryFieldConfig> {
  if (factor < 1) throw new RangeError(`factor must be at least 1 (received ${factor}).`)

  return Object.fromEntries(
    Object.entries(fields).map(([name, config]) => [
      name,
      { ...config, interval_seconds: Math.round(config.interval_seconds * factor) },
    ]),
  )
}
