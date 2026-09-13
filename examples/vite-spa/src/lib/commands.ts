/**
 * @file The commands this app can run, as a closed set.
 *
 * The UI sends a key from {@link COMMANDS}, never a Fleet API command name.
 * That keeps the button grid and the reachable API surface in one place: a new
 * control is one entry here, and nothing outside this table is callable.
 */

import type { CommandResult, TeslaClient } from '@bankkroll/tesdk'

/** A command the UI exposes, with the label on its button. */
interface Command {
  label: string
  run: (client: TeslaClient, vin: string) => Promise<CommandResult>
}

/**
 * Every runnable command, in display order.
 *
 * `wake` is listed last and handled specially by the UI: it is the remedy for
 * a sleeping vehicle rather than an action on a working one.
 */
export const COMMANDS = {
  lock: { label: 'Lock', run: (client, vin) => client.commands.doorLock(vin) },
  unlock: { label: 'Unlock', run: (client, vin) => client.commands.doorUnlock(vin) },
  climateOn: { label: 'Climate on', run: (client, vin) => client.commands.climateStart(vin) },
  climateOff: { label: 'Climate off', run: (client, vin) => client.commands.climateStop(vin) },
  chargeStart: { label: 'Start charge', run: (client, vin) => client.commands.chargeStart(vin) },
  chargeStop: { label: 'Stop charge', run: (client, vin) => client.commands.chargeStop(vin) },
  flash: { label: 'Flash lights', run: (client, vin) => client.commands.flashLights(vin) },
  honk: { label: 'Honk', run: (client, vin) => client.commands.honkHorn(vin) },
  wake: { label: 'Wake', run: (client, vin) => client.vehicles.wakeUp(vin) },
} as const satisfies Record<string, Command>

/** Key of a command in {@link COMMANDS}. */
export type CommandName = keyof typeof COMMANDS

/** Commands rendered in the button grid, excluding the wake remedy. */
export const CONTROL_NAMES = (Object.keys(COMMANDS) as CommandName[]).filter(
  (name) => name !== 'wake',
)
