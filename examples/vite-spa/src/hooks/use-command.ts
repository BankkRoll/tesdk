/**
 * @file Runs vehicle commands and reports their outcome.
 *
 * Two distinctions the Fleet API makes and this hook preserves:
 *
 * - A **rejection** (`result: false` with a reason) is a successful request
 *   that the vehicle declined — a door already locked, a charge cable absent.
 *   It is not an exception and must not be reported as one.
 * - A **sleeping vehicle** raises `VehicleAsleepError`. Commands are wrapped
 *   in `withWake`, which wakes once and retries: pressing a button is a
 *   deliberate act, so the battery cost of waking is expected here even though
 *   the SDK never wakes on its own.
 */

import { useCallback, useState, useTransition } from 'react'
import type { TeslaClient } from 'tesdk'
import { COMMANDS, type CommandName } from '../lib/commands.ts'
import { describeError, type Failure } from '../lib/errors.ts'

/** Outcome of the most recent command. */
export type CommandOutcome =
  | { status: 'ok'; message: string }
  | { status: 'failed'; failure: Failure }

/** Command execution state and the function that starts one. */
export interface CommandRunner {
  /** Whether a command is in flight. */
  pending: boolean
  /** Result of the last command, or `undefined` before the first. */
  outcome: CommandOutcome | undefined
  /** Sends a command from the {@link COMMANDS} allowlist. */
  run: (name: CommandName) => void
  /** Clears the last outcome, for instance when the visitor navigates away. */
  reset: () => void
}

/**
 * Creates a command runner bound to one vehicle.
 *
 * @param client - Authenticated client, absent while signed out.
 * @param vin - Target vehicle.
 * @param onSettled - Called after a successful command so the caller can
 * refresh the data the command just changed.
 * @returns The {@link CommandRunner}.
 *
 * @example
 * ```ts
 * const { run, pending } = useCommand(client, vin, reload)
 * <button disabled={pending} onClick={() => run('lock')}>Lock</button>
 * ```
 */
export function useCommand(
  client: TeslaClient | undefined,
  vin: string,
  onSettled: () => void,
): CommandRunner {
  const [pending, startTransition] = useTransition()
  const [outcome, setOutcome] = useState<CommandOutcome | undefined>(undefined)

  const reset = useCallback(() => {
    setOutcome(undefined)
  }, [])

  const run = useCallback(
    (name: CommandName) => {
      if (!client) return
      const command = COMMANDS[name]

      startTransition(async () => {
        try {
          const result = await client.vehicles.withWake(vin, () => command.run(client, vin))

          if (result.result === false) {
            setOutcome({
              status: 'failed',
              failure: { message: result.reason ?? 'The vehicle declined the command.' },
            })
            return
          }

          setOutcome({ status: 'ok', message: `${command.label} sent.` })
          onSettled()
        } catch (error) {
          setOutcome({ status: 'failed', failure: describeError(error) })
        }
      })
    },
    [client, vin, onSettled],
  )

  return { pending, outcome, run, reset }
}
