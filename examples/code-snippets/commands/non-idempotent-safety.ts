/**
 * @file Why some commands are never retried, and how to keep it that way.
 *
 * Prerequisites: a token with `vehicle_cmds`.
 */

import { TeslaClient, type CommandResult } from 'tesdk'

/**
 * Honks the horn exactly once, or fails.
 *
 * `honkHorn` is sent with `idempotent: false`, so a timeout or a 503 propagates
 * instead of being retried. The request may still have reached the vehicle, but
 * a retry would risk two honks — and one uncertain honk beats two certain ones.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function honkOnce(client: TeslaClient, vin: string): Promise<CommandResult> {
  return await client.commands.honkHorn(vin)
}

/**
 * Actuates the rear trunk, which toggles rather than sets.
 *
 * A retried toggle lands the trunk back where it started, so the SDK never
 * retries it. The same reasoning covers `flashLights`, the media controls, and
 * `createShareInvite`.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 */
export async function openTrunk(client: TeslaClient, vin: string): Promise<CommandResult> {
  return await client.commands.actuateTrunk(vin, 'rear')
}

/**
 * Sends a custom command that has a visible physical effect.
 *
 * `send` defaults to `idempotent: false` for exactly this reason; leave it
 * alone unless the command genuinely sets a state rather than toggling one.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param sound - `0` for the random fart, `2000` for the locate ping.
 */
export async function playSound(
  client: TeslaClient,
  vin: string,
  sound: 0 | 2000,
): Promise<CommandResult> {
  return await client.commands.remoteBoombox(vin, sound)
}

/**
 * Marks a custom state-setting command as safe to retry.
 *
 * Opt in only when applying the command twice is indistinguishable from
 * applying it once, as it is for a limit, a mode, or a lock.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param percent - Target state of charge.
 */
export async function setLimitRetryable(
  client: TeslaClient,
  vin: string,
  percent: number,
): Promise<CommandResult> {
  return await client.commands.send(vin, 'set_charge_limit', { percent }, { idempotent: true })
}
