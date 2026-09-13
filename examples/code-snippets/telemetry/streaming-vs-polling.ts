/**
 * @file The cost difference between polling `vehicle_data` and streaming, made
 * concrete.
 *
 * Prerequisites: none for the estimator; a configured Fleet Telemetry server
 * for the migration helper.
 */

import { TeslaClient, type TelemetryConfig } from '@bankkroll/tesdk'

/** What a monitoring strategy costs per vehicle per day. */
export interface DailyCost {
  /** Billable `vehicle_data` calls per vehicle per day. */
  dataCalls: number
  /**
   * Hours per day the vehicle is held awake.
   *
   * A polled vehicle cannot enter deep sleep, which is the real cost: it drains
   * range around the clock, and users notice that long before they see a bill.
   */
  awakeHours: number
}

/** A vehicle stays awake roughly this long after a `vehicle_data` read. */
const WAKE_MINUTES_PER_POLL = 15

/**
 * Estimates what polling costs at a given interval.
 *
 * @param intervalSeconds - How often `vehicle_data` is called.
 * @returns Daily calls and hours awake per vehicle.
 *
 * @example
 * ```ts
 * pollingCost(300) // { dataCalls: 288, awakeHours: 24 }
 * ```
 */
export function pollingCost(intervalSeconds: number): DailyCost {
  const dataCalls = Math.floor(86_400 / intervalSeconds)
  const awakeMinutes = Math.min(1_440, dataCalls * WAKE_MINUTES_PER_POLL)
  return { dataCalls, awakeHours: awakeMinutes / 60 }
}

/**
 * What the same coverage costs over Fleet Telemetry.
 *
 * Streaming is push: the vehicle publishes from its existing connection, so
 * there are no `vehicle_data` calls and nothing keeps it awake.
 */
export function streamingCost(): DailyCost {
  return { dataCalls: 0, awakeHours: 0 }
}

/**
 * Replaces a polling loop with an equivalent telemetry configuration.
 *
 * The interval maps across directly, but the semantics improve: a polled read
 * returns the same value repeatedly while nothing changes, whereas a streamed
 * field publishes only on change, so an idle vehicle produces no traffic at all.
 *
 * @param proxyClient - Client pointed at a Vehicle Command Proxy.
 * @param vins - Vehicles currently being polled.
 * @param server - Fleet Telemetry server address and CA chain.
 * @param intervalSeconds - The polling interval being replaced.
 * @returns The configuration that was applied.
 */
export async function migrateFromPolling(
  proxyClient: TeslaClient,
  vins: string[],
  server: { hostname: string; ca: string },
  intervalSeconds: number,
): Promise<TelemetryConfig> {
  const config: TelemetryConfig = {
    hostname: server.hostname,
    ca: server.ca,
    fields: {
      Soc: { interval_seconds: intervalSeconds },
      DetailedChargeState: { interval_seconds: intervalSeconds },
      Location: { interval_seconds: intervalSeconds, minimum_delta: 50 },
    },
  }

  await proxyClient.telemetry.createConfig(vins, config)
  return config
}
