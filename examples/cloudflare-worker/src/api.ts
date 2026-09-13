/**
 * @file The JSON API served by the `fetch` handler.
 *
 * Routes are matched with `URLPattern`, which the Workers runtime provides, so
 * no router dependency is needed. Every handler receives an already-validated
 * context and lets errors propagate to the entry point's mapper.
 */

import { VehicleAsleepError, type CommandResult, type TeslaClient } from 'tesdk'
import { json } from './http.js'
import { getRunSummary, getSnapshot, listSnapshots } from './store.js'

/** Everything a route handler needs for one request. */
export interface RouteContext {
  client: TeslaClient
  kv: KVNamespace
  url: URL
}

/**
 * Commands callable over HTTP.
 *
 * A closed allowlist rather than a passthrough to `client.commands.send`:
 * without it, anyone holding the API token could invoke every command the
 * granted scopes permit, including ones this Worker has no business exposing.
 */
const COMMANDS: Record<string, (client: TeslaClient, vin: string) => Promise<CommandResult>> = {
  lock: async (client, vin) => await client.commands.doorLock(vin),
  unlock: async (client, vin) => await client.commands.doorUnlock(vin),
  'charge-start': async (client, vin) => await client.commands.chargeStart(vin),
  'charge-stop': async (client, vin) => await client.commands.chargeStop(vin),
  flash: async (client, vin) => await client.commands.flashLights(vin),
}

const ROUTES = {
  vehicles: new URLPattern({ pathname: '/api/vehicles' }),
  vehicle: new URLPattern({ pathname: '/api/vehicles/:vin' }),
  command: new URLPattern({ pathname: '/api/vehicles/:vin/commands/:name' }),
  snapshots: new URLPattern({ pathname: '/api/snapshots' }),
  health: new URLPattern({ pathname: '/api/health' }),
} as const

/**
 * Lists the fleet, annotated with the most recent recorded reading.
 *
 * Live connectivity comes from Fleet API; the charge figures come from KV, so
 * a sleeping vehicle still reports its last known state instead of nothing.
 */
async function listVehicles({ client, kv }: RouteContext): Promise<Response> {
  const [vehicles, snapshots] = await Promise.all([client.vehicles.list(), listSnapshots(kv)])
  const byVin = new Map(snapshots.map((snapshot) => [snapshot.vin, snapshot]))

  return json({
    vehicles: vehicles.map((vehicle) => ({
      vin: vehicle.vin,
      displayName: vehicle.display_name,
      state: vehicle.state,
      inService: vehicle.in_service,
      lastSnapshot: byVin.get(vehicle.vin),
    })),
  })
}

/**
 * Returns live charge and climate state for one vehicle.
 *
 * `?wake=1` opts into waking a sleeping vehicle. It is off by default because
 * waking costs battery, and a status poll is not worth that on its own; a
 * sleeping vehicle falls back to the monitor's last recorded reading.
 */
async function getVehicle({ client, kv, url }: RouteContext, vin: string): Promise<Response> {
  const read = async () =>
    await client.vehicles.data(vin, { endpoints: ['charge_state', 'climate_state'] })

  const wake = url.searchParams.get('wake') === '1'

  try {
    const data = wake ? await client.vehicles.withWake(vin, read) : await read()
    return json({ vin, live: true, charge: data.charge_state, climate: data.climate_state })
  } catch (error) {
    // A sleeping vehicle is an expected state, not a failure: fall back to the
    // reading the monitor recorded rather than making the caller retry.
    if (!(error instanceof VehicleAsleepError)) throw error

    const snapshot = await getSnapshot(kv, vin)
    if (!snapshot) throw error

    return json({ vin, live: false, lastSnapshot: snapshot })
  }
}

/**
 * Runs an allowlisted command.
 *
 * Wrapped in `withWake` because a command is a deliberate action by a caller
 * who wants it to take effect, which makes the battery cost of waking expected.
 */
async function runCommand({ client }: RouteContext, vin: string, name: string): Promise<Response> {
  const command = COMMANDS[name]
  if (!command) {
    return json(
      {
        code: 'invalid_request',
        message: `Unknown command "${name}".`,
        supported: Object.keys(COMMANDS),
      },
      { status: 400 },
    )
  }

  const result = await client.vehicles.withWake(vin, async () => await command(client, vin))

  // A rejected command is a successful HTTP call reporting `result: false`,
  // not a transport failure, so it is a 200 with the vehicle's reason.
  return json({ vin, command: name, accepted: result.result !== false, reason: result.reason })
}

/** Serves the readings the scheduled monitor recorded, without calling Fleet API. */
async function snapshots({ kv }: RouteContext): Promise<Response> {
  return json({ snapshots: await listSnapshots(kv) })
}

/** Reports the outcome of the most recent cron run. */
async function health({ kv }: RouteContext): Promise<Response> {
  const lastRun = await getRunSummary(kv)
  return json({ ok: lastRun === undefined || lastRun.errors.length === 0, lastRun })
}

/**
 * Dispatches a request to the matching API route.
 *
 * @param request - The incoming request.
 * @param context - Client, KV binding, and parsed URL for this request.
 * @returns The route's response, or `undefined` when nothing matched.
 */
export async function handleApi(
  request: Request,
  context: RouteContext,
): Promise<Response | undefined> {
  const { url } = context
  const href = url.href

  if (request.method === 'GET' && ROUTES.health.test(href)) return await health(context)
  if (request.method === 'GET' && ROUTES.snapshots.test(href)) return await snapshots(context)
  if (request.method === 'GET' && ROUTES.vehicles.test(href)) return await listVehicles(context)

  const vehicleMatch = ROUTES.vehicle.exec(href)
  if (request.method === 'GET' && vehicleMatch) {
    const vin = vehicleMatch.pathname.groups['vin']
    if (vin) return await getVehicle(context, vin)
  }

  const commandMatch = ROUTES.command.exec(href)
  if (request.method === 'POST' && commandMatch) {
    const { vin, name } = commandMatch.pathname.groups
    if (vin && name) return await runCommand(context, vin, name)
  }

  return undefined
}
