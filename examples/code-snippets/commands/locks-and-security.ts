/**
 * @file Locks, Sentry Mode, Valet Mode, and Speed Limit Mode.
 *
 * Prerequisites: a token with `vehicle_cmds`, and a Vehicle Command Proxy for
 * vehicles that require signing.
 */

import { TeslaClient, type CommandResult } from '@bankkroll/tesdk'

/**
 * Locks the doors, waking the vehicle first if it is asleep.
 *
 * `doorLock` is idempotent — locking a locked car changes nothing — so the SDK
 * retries it on transient failures.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @throws {SigningRequiredError} When the vehicle needs a signed command and the
 * client is not pointed at a proxy.
 */
export async function lock(client: TeslaClient, vin: string): Promise<CommandResult> {
  return await client.vehicles.withWake(vin, () => client.commands.doorLock(vin))
}

/** Unlocks the doors. */
export async function unlock(client: TeslaClient, vin: string): Promise<CommandResult> {
  return await client.vehicles.withWake(vin, () => client.commands.doorUnlock(vin))
}

/**
 * Turns Sentry Mode on or off.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param on - Desired state.
 */
export async function setSentry(
  client: TeslaClient,
  vin: string,
  on: boolean,
): Promise<CommandResult> {
  return await client.commands.setSentryMode(vin, on)
}

/**
 * Hands the vehicle to a valet, restricting speed and locking the glovebox.
 *
 * The passcode is what the valet must enter to exit the mode, so it is required
 * on the way in and again on the way out.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param passcode - Four-digit code.
 */
export async function enterValetMode(
  client: TeslaClient,
  vin: string,
  passcode: string,
): Promise<CommandResult> {
  return await client.commands.setValetMode(vin, true, passcode)
}

/**
 * Applies a speed cap for a borrowed vehicle.
 *
 * The limit must be set before the mode is activated: activating first leaves
 * the vehicle on whatever cap it last held.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @param limitMph - Maximum speed in miles per hour.
 * @param pin - Four-digit PIN required to lift the limit.
 */
export async function capSpeed(
  client: TeslaClient,
  vin: string,
  limitMph: number,
  pin: string,
): Promise<void> {
  await client.commands.speedLimitSetLimit(vin, limitMph)
  await client.commands.speedLimitActivate(vin, pin)
}
