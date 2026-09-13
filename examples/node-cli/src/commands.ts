/**
 * @file Command implementations.
 *
 * Each command receives the resolved client and the remaining argv, so the
 * dispatcher in `main.ts` stays a lookup table.
 */

import {
  SigningRequiredError,
  type CommandResult,
  type TeslaClient,
  type Vehicle,
  type VehicleData,
} from 'tesdk'
import { bar, bold, cyan, dim, green, heading, line, row, spin, stateBadge, yellow } from './ui.ts'

/** Signature shared by every command. */
export type Command = (client: TeslaClient, args: string[]) => Promise<void>

/**
 * Resolves a VIN from an argument, falling back to the only vehicle on the
 * account.
 *
 * @throws {Error} When no VIN is given and the account has several vehicles.
 */
async function resolveVin(client: TeslaClient, given: string | undefined): Promise<string> {
  if (given) return given

  const vehicles = await spin('Loading vehicles', () => client.vehicles.list())
  if (vehicles.length === 0) throw new Error('No vehicles on this account.')
  if (vehicles.length > 1) {
    const names = vehicles.map((v) => `  ${v.vin}  ${v.display_name ?? ''}`).join('\n')
    throw new Error(`Several vehicles found — pass a VIN:\n${names}`)
  }
  return vehicles[0]!.vin
}

/** Formats a distance in the account's unit, which Tesla reports in miles. */
function formatRange(miles: number | undefined): string {
  if (miles === undefined) return dim('unknown')
  return `${Math.round(miles)} mi ${dim(`(${Math.round(miles * 1.60934)} km)`)}`
}

/** Prints the charge, climate, and location summary for one vehicle. */
function renderVehicle(vehicle: Vehicle, data: VehicleData | undefined): void {
  heading(`${vehicle.display_name ?? vehicle.vin}`)
  row('VIN', vehicle.vin)
  row('State', stateBadge(vehicle.state))

  if (!data) {
    row('Data', dim('vehicle asleep — pass --wake to read live data'))
    return
  }

  const charge = data.charge_state
  if (charge) {
    row('Battery', `${bar(charge.battery_level)} ${bold(`${charge.battery_level}%`)}`)
    row('Range', formatRange(charge.battery_range))
    row('Charging', charge.charging_state)
    if (charge.charging_state === 'Charging') {
      row('Rate', `${charge.charger_power ?? 0} kW`)
      row('Time to full', `${charge.minutes_to_full_charge ?? 0} min`)
    }
    row('Charge limit', `${charge.charge_limit_soc}%`)
  }

  const climate = data.climate_state
  if (climate) {
    const inside = climate.inside_temp === null ? dim('n/a') : `${climate.inside_temp}°C`
    const outside = climate.outside_temp === null ? dim('n/a') : `${climate.outside_temp}°C`
    row('Climate', `${climate.is_climate_on ? green('on') : dim('off')}  inside ${inside}  outside ${outside}`)
  }

  const drive = data.drive_state
  if (drive?.latitude !== undefined && drive.longitude !== undefined) {
    row('Location', `${drive.latitude.toFixed(4)}, ${drive.longitude.toFixed(4)}`)
  }
  if (drive?.shift_state) row('Gear', drive.shift_state)
}

/** Lists every vehicle with its connectivity state. */
export const listVehicles: Command = async (client) => {
  const vehicles = await spin('Loading vehicles', () => client.vehicles.list())

  if (vehicles.length === 0) {
    line(dim('No vehicles on this account.'))
    return
  }

  heading(`${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`)
  for (const vehicle of vehicles) {
    line(`  ${stateBadge(vehicle.state).padEnd(24)} ${bold(vehicle.display_name ?? '—')}  ${dim(vehicle.vin)}`)
  }
}

/**
 * Shows a full status report.
 *
 * Reads live data only when the vehicle is already online, unless `--wake` is
 * passed, because waking a sleeping vehicle drains the traction battery.
 */
export const status: Command = async (client, args) => {
  const wake = args.includes('--wake')
  const vin = await resolveVin(
    client,
    args.find((a) => !a.startsWith('--')),
  )

  const vehicle = await spin('Reading vehicle', () => client.vehicles.get(vin))

  if (vehicle.state !== 'online' && !wake) {
    renderVehicle(vehicle, undefined)
    return
  }

  const data = await spin('Reading live data', () =>
    wake
      ? client.vehicles.withWake(vin, () => client.vehicles.data(vin))
      : client.vehicles.data(vin),
  )

  renderVehicle(vehicle, data)
}

/** Streams a status line at a fixed interval until interrupted. */
export const watch: Command = async (client, args) => {
  const vin = await resolveVin(
    client,
    args.find((a) => !a.startsWith('--')),
  )
  const seconds = Number(args.find((a) => a.startsWith('--interval='))?.split('=')[1] ?? '30')

  line(dim(`Polling every ${seconds}s. Press Ctrl+C to stop.`))
  line(dim('Fleet Telemetry is the cheaper way to do this in production.'))

  const controller = new AbortController()
  process.on('SIGINT', () => {
    controller.abort()
  })

  while (!controller.signal.aborted) {
    try {
      const data = await client.vehicles.data(vin, {
        endpoints: ['charge_state'],
        signal: controller.signal,
      })
      const charge = data.charge_state
      const stamp = new Date().toLocaleTimeString()
      line(
        `${dim(stamp)}  ${bar(charge?.battery_level ?? 0, 16)} ${bold(`${charge?.battery_level ?? 0}%`)}  ${charge?.charging_state ?? ''}`,
      )
    } catch (error) {
      if (controller.signal.aborted) break
      line(`${yellow('warn')} ${(error as Error).message}`)
    }

    await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  }
}

/** Result of any action: a command acknowledgement or a vehicle snapshot. */
type ActionResult = CommandResult | Vehicle

/** Signature every entry in {@link VEHICLE_ACTIONS} conforms to. */
type ActionFn = (client: TeslaClient, vin: string) => Promise<ActionResult>

/**
 * Command names mapped to the SDK call they perform.
 *
 * `satisfies` keeps the literal key union available to {@link isVehicleAction}
 * while still checking every value against {@link ActionFn}.
 */
const VEHICLE_ACTIONS = {
  lock: (client, vin) => client.commands.doorLock(vin),
  unlock: (client, vin) => client.commands.doorUnlock(vin),
  honk: (client, vin) => client.commands.honkHorn(vin),
  flash: (client, vin) => client.commands.flashLights(vin),
  'charge-start': (client, vin) => client.commands.chargeStart(vin),
  'charge-stop': (client, vin) => client.commands.chargeStop(vin),
  'climate-on': (client, vin) => client.commands.climateStart(vin),
  'climate-off': (client, vin) => client.commands.climateStop(vin),
  wake: (client, vin) => client.vehicles.wakeUp(vin),
} satisfies Record<string, ActionFn>

/** Command names that this CLI accepts as vehicle actions. */
export type VehicleAction = keyof typeof VEHICLE_ACTIONS

/** Whether a string names a vehicle action. */
export function isVehicleAction(name: string): name is VehicleAction {
  return name in VEHICLE_ACTIONS
}

/**
 * Runs a vehicle action, waking the vehicle first when needed.
 *
 * Surfaces {@link SigningRequiredError} with the remedy, since an unsigned
 * command is the most common first-run failure.
 */
export function vehicleAction(action: VehicleAction): Command {
  return async (client, args) => {
    const vin = await resolveVin(
      client,
      args.find((a) => !a.startsWith('--')),
    )

    try {
      const result = await spin(`Sending ${action}`, () =>
        client.vehicles.withWake(vin, () => VEHICLE_ACTIONS[action](client, vin)),
      )

      if ('result' in result && result.result === false) {
        line(`${yellow('rejected')} ${result.reason ?? 'the vehicle declined the command'}`)
        return
      }
      line(`${green('✓')} ${action}`)
    } catch (error) {
      if (error instanceof SigningRequiredError) {
        line(`${yellow('!')} This vehicle requires signed commands.`)
        line(dim('  Run the Vehicle Command Proxy and set TESLA_PROXY_URL:'))
        line(dim('  https://github.com/teslamotors/vehicle-command'))
        return
      }
      throw error
    }
  }
}

/** Sets the charge limit as a percentage. */
export const setChargeLimit: Command = async (client, args) => {
  const positional = args.filter((a) => !a.startsWith('--'))
  const percent = Number(positional.at(-1))

  if (!Number.isInteger(percent) || percent < 50 || percent > 100) {
    throw new Error('Usage: charge-limit [vin] <50-100>')
  }

  const vin = await resolveVin(client, positional.length > 1 ? positional[0] : undefined)
  await spin('Setting charge limit', () =>
    client.vehicles.withWake(vin, () => client.commands.setChargeLimit(vin, percent)),
  )
  line(`${green('✓')} charge limit set to ${percent}%`)
}

/** Reports whether each vehicle needs the Vehicle Command Proxy. */
export const fleetStatus: Command = async (client) => {
  const vehicles = await spin('Loading vehicles', () => client.vehicles.list())
  if (vehicles.length === 0) {
    line(dim('No vehicles on this account.'))
    return
  }

  const status = await spin('Checking capabilities', () =>
    client.vehicles.fleetStatus(vehicles.map((v) => v.vin)),
  )

  heading('Command protocol')
  for (const vehicle of vehicles) {
    const info = status.vehicle_info?.[vehicle.vin]
    const needsProxy = info?.vehicle_command_protocol_required ?? false
    row(
      vehicle.display_name ?? vehicle.vin,
      needsProxy ? `${yellow('proxy required')}  ${dim(info?.firmware_version ?? '')}` : green('direct'),
      24,
    )
  }

  const paired = status.key_paired_vins ?? []
  if (paired.length > 0) heading('Virtual key paired')
  for (const vin of paired) row(vin, green('✓'), 24)
}

/** Lists energy sites and their live power flow. */
export const energy: Command = async (client) => {
  const products = await spin('Loading products', () => client.energy.products())
  const sites = products.filter((p) => p.energy_site_id !== undefined)

  if (sites.length === 0) {
    line(dim('No energy products on this account.'))
    return
  }

  for (const site of sites) {
    const id = site.energy_site_id!
    const live = await spin(`Reading site ${id}`, () => client.energy.liveStatus(id))

    heading(site.site_name ?? `Site ${id}`)
    row('Solar', `${live.solar_power ?? 0} W`)
    row('Battery', `${live.battery_power ?? 0} W`)
    row('Grid', `${live.grid_power ?? 0} W`)
    row('Load', `${live.load_power ?? 0} W`)
    if (live.percentage_charged !== undefined) {
      row('Charge', `${bar(live.percentage_charged)} ${Math.round(live.percentage_charged)}%`)
    }
    row('Grid status', live.grid_status ?? dim('unknown'))
  }
}

/** Prints the signed-in account and its assigned region. */
export const whoami: Command = async (client) => {
  const [profile, region] = await spin('Reading account', () =>
    Promise.all([client.user.me(), client.user.region()]),
  )

  heading('Account')
  row('Name', profile.full_name ?? dim('—'))
  row('Email', profile.email ?? dim('—'))
  row('Region', region.region)
  row('Base URL', cyan(region.fleet_api_base_url))
}
