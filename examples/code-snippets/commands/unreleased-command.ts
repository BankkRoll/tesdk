/**
 * @file Calling a Fleet API command newer than this SDK.
 *
 * Prerequisites: a token with `vehicle_cmds`.
 */

import { TeslaClient, type CommandResult, type SendCommandOptions } from 'tesdk'

/**
 * Sends any command by its Fleet API path segment.
 *
 * The escape hatch for endpoints Tesla ships between SDK releases: the
 * transport, auth, retry policy, and error mapping are identical to the typed
 * methods, only the name and body are yours to supply.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param command - Command name exactly as it appears in the endpoint path.
 * @param body - JSON body, omitted for commands that take no parameters.
 * @param options - Retry and failure handling, defaulting to non-idempotent.
 *
 * @example
 * ```ts
 * await sendRaw(client, vin, 'set_cop_temp', { cop_temp: 1 })
 * ```
 */
export async function sendRaw(
  client: TeslaClient,
  vin: string,
  command: string,
  body?: Record<string, unknown>,
  options?: SendCommandOptions,
): Promise<CommandResult> {
  return await client.commands.send(vin, command, body, options)
}

/**
 * Wraps an unreleased command in the same typed shape a first-class method has.
 *
 * Worth doing for anything called from more than one place: the workaround
 * stays in one file, and swapping it for the real method later touches nothing
 * else.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param level - Cabin Overheat Protection temperature, `0` low through `2` high.
 */
export async function setCabinOverheatTemp(
  client: TeslaClient,
  vin: string,
  level: 0 | 1 | 2,
): Promise<CommandResult> {
  return await client.commands.send(
    vin,
    'set_cop_temp',
    { cop_temp: level },
    // A temperature setpoint is a state, so re-applying it is harmless.
    { idempotent: true, throwOnFailure: true },
  )
}

/**
 * Forwards a command envelope signed outside this SDK.
 *
 * Only for callers doing their own Vehicle Command Protocol signing. A Vehicle
 * Command Proxy signs the ordinary methods for you and needs none of this.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param payload - Signed protocol message.
 */
export async function forwardSigned(
  client: TeslaClient,
  vin: string,
  payload: Record<string, unknown>,
): Promise<CommandResult> {
  return await client.commands.signedCommand(vin, payload)
}
