/**
 * @file Telling a rejected command apart from a failed request.
 *
 * Prerequisites: a token with `vehicle_cmds`.
 */

import { TeslaError, TeslaClient, type CommandResult } from '@bankkroll/tesdk'

/**
 * Sends a command and treats a vehicle-side rejection as an error.
 *
 * A `result: false` payload is an HTTP 200: the request reached the vehicle and
 * the vehicle declined it — the charge port is already open, a door is ajar, the
 * vehicle is in gear. The SDK resolves rather than throws so callers can
 * distinguish that from a transport failure. `throwOnFailure` opts into the
 * simpler behaviour when a rejection is not worth handling separately.
 *
 * @param client - Authenticated client.
 * @param vin - Vehicle identification number.
 * @throws {TeslaError} When the vehicle rejects the command, with `body` set to
 * the result payload carrying the reason.
 */
export async function lockOrThrow(client: TeslaClient, vin: string): Promise<CommandResult> {
  return await client.commands.doorLock(vin, { throwOnFailure: true })
}

/** Outcome of a command that separates rejection from failure. */
export type CommandOutcome =
  | { status: 'accepted' }
  | { status: 'rejected'; reason: string }
  | { status: 'failed'; error: TeslaError }

/**
 * Classifies a command into the three outcomes a UI actually cares about.
 *
 * Rejections are usually worth showing verbatim — the vehicle's reason is more
 * useful than anything the application could invent — while transport failures
 * warrant a retry affordance instead.
 *
 * @param send - Thunk performing the command.
 * @returns Which of the three happened.
 *
 * @example
 * ```ts
 * const outcome = await classify(() => client.commands.actuateTrunk(vin, 'rear'))
 * if (outcome.status === 'rejected') console.warn(outcome.reason)
 * ```
 */
export async function classify(send: () => Promise<CommandResult>): Promise<CommandOutcome> {
  try {
    const result = await send()
    // Only an explicit `false` is a rejection; an absent flag means the vehicle
    // returned a payload that carries no result at all.
    return result.result === false
      ? { status: 'rejected', reason: result.reason ?? 'unknown reason' }
      : { status: 'accepted' }
  } catch (error) {
    if (error instanceof TeslaError) return { status: 'failed', error }
    throw error
  }
}
