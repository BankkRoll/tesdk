/**
 * @file The scheduled fleet monitor.
 *
 * Runs on the cron trigger, reads charge state for every online vehicle, and
 * writes the readings to KV so the HTTP API can serve them without touching
 * Fleet API. Everything here runs at the edge with no browser and no Node
 * runtime behind it.
 */

import { TeslaError, VehicleAsleepError, type TeslaClient, type Vehicle } from '@bankkroll/tesdk'
import { putRunSummary, putSnapshot, type ChargeSnapshot, type RunSummary } from './store.js'

/**
 * Vehicles are polled a few at a time. Fleet API rate limits are per-account,
 * and a fully parallel fan-out across a large fleet trips them long before it
 * exhausts the Worker's own budget.
 */
const CONCURRENCY = 3

/**
 * Polls one vehicle and records the result.
 *
 * `charge_state` alone is requested because every extra subtree lengthens the
 * response and keeps the vehicle awake longer, both of which cost battery.
 *
 * @param client - Authenticated client.
 * @param kv - Namespace bound as `TESLA_KV`.
 * @param vehicle - Vehicle from the fleet listing.
 * @returns An empty object on success, `skipped` with the VIN when the vehicle
 * was unreachable, or `error` with a message the run summary can report.
 */
async function pollVehicle(
  client: TeslaClient,
  kv: KVNamespace,
  vehicle: Vehicle,
): Promise<{ skipped?: string; error?: string }> {
  const base = {
    vin: vehicle.vin,
    displayName: vehicle.display_name,
    recordedAt: new Date().toISOString(),
  }

  // The monitor never wakes a vehicle: a poll every fifteen minutes that wakes
  // the car each time would flatten the battery. A sleeping vehicle simply has
  // no reading this cycle.
  if (vehicle.state !== 'online') {
    return { skipped: vehicle.vin }
  }

  try {
    const data = await client.vehicles.data(vehicle.vin, { endpoints: ['charge_state'] })
    const charge = data.charge_state

    const snapshot: ChargeSnapshot = {
      ...base,
      ...(charge
        ? {
            batteryLevel: charge.battery_level,
            range: charge.battery_range,
            chargingState: charge.charging_state,
            chargeLimit: charge.charge_limit_soc,
            ...(charge.charger_power !== undefined ? { chargerPower: charge.charger_power } : {}),
          }
        : {}),
    }

    await putSnapshot(kv, snapshot)
    return {}
  } catch (error) {
    if (error instanceof VehicleAsleepError) {
      return { skipped: vehicle.vin }
    }

    const message = error instanceof Error ? error.message : String(error)
    const requestId = error instanceof TeslaError ? error.requestId : undefined

    await putSnapshot(kv, { ...base, error: message })
    return { error: `${vehicle.vin}: ${message}${requestId ? ` (x-txid ${requestId})` : ''}` }
  }
}

/**
 * Polls the whole fleet and records a run summary.
 *
 * Never throws: a cron handler that throws is retried by the platform, and a
 * failing account would then be retried indefinitely. The failure is recorded
 * in the summary instead, where `/api/health` surfaces it.
 *
 * @param client - Authenticated client.
 * @param kv - Namespace bound as `TESLA_KV`.
 * @param cron - Cron expression that fired this run.
 * @returns The summary that was written to KV.
 */
export async function runMonitor(
  client: TeslaClient,
  kv: KVNamespace,
  cron: string,
): Promise<RunSummary> {
  const startedAt = Date.now()
  const summary: RunSummary = {
    ranAt: new Date(startedAt).toISOString(),
    cron,
    vehiclesPolled: 0,
    skipped: [],
    errors: [],
    durationMs: 0,
  }

  try {
    const vehicles = await client.vehicles.list()

    for (let index = 0; index < vehicles.length; index += CONCURRENCY) {
      const batch = vehicles.slice(index, index + CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (vehicle) => await pollVehicle(client, kv, vehicle)),
      )

      for (const result of results) {
        if (result.skipped !== undefined) summary.skipped.push(result.skipped)
        else if (result.error !== undefined) summary.errors.push(result.error)
        else summary.vehiclesPolled += 1
      }
    }
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : String(error))
  }

  summary.durationMs = Date.now() - startedAt
  await putRunSummary(kv, summary)

  console.log(JSON.stringify({ event: 'monitor.run', ...summary }))
  return summary
}
