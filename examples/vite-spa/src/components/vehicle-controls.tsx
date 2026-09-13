/**
 * @file Command grid and charge-limit slider.
 *
 * One generic button drives every command, so adding a control is a one-line
 * change to the {@link COMMANDS} table rather than new component code. The
 * slider commits on pointer release rather than on change, because every drag
 * step would otherwise be a separate Fleet API request.
 */

import { useCallback, useState } from 'react'
import type { TeslaClient } from 'tesdk'
import { useCommand } from '../hooks/use-command.ts'
import { COMMANDS, CONTROL_NAMES } from '../lib/commands.ts'
import { describeError, type Failure } from '../lib/errors.ts'
import { Notice } from './notice.tsx'

/** Fleet API rejects charge limits outside this range. */
const CHARGE_LIMIT = { min: 50, max: 100, step: 5, fallback: 80 } as const

/** Props for {@link VehicleControls}. */
export interface VehicleControlsProps {
  client: TeslaClient
  vin: string
  /** Current limit, used as the slider's starting value. */
  chargeLimit: number | undefined
  /** Called after a command succeeds, so the caller can refresh its data. */
  onSettled: () => void
}

/**
 * Renders the command buttons and the charge-limit slider.
 *
 * @param props - See {@link VehicleControlsProps}.
 */
export function VehicleControls({
  client,
  vin,
  chargeLimit,
  onSettled,
}: VehicleControlsProps): React.JSX.Element {
  const { pending, outcome, run } = useCommand(client, vin, onSettled)
  const [limit, setLimit] = useState(chargeLimit ?? CHARGE_LIMIT.fallback)
  const [limitFailure, setLimitFailure] = useState<Failure | undefined>(undefined)
  const [savingLimit, setSavingLimit] = useState(false)

  const commitLimit = useCallback(() => {
    if (limit === chargeLimit) return
    setSavingLimit(true)
    setLimitFailure(undefined)

    client.vehicles
      .withWake(vin, () => client.commands.setChargeLimit(vin, limit))
      .then(onSettled)
      .catch((error: unknown) => {
        setLimitFailure(describeError(error))
      })
      .finally(() => {
        setSavingLimit(false)
      })
  }, [client, vin, limit, chargeLimit, onSettled])

  const busy = pending || savingLimit

  return (
    <>
      {outcome ? (
        outcome.status === 'ok' ? (
          <Notice ok message={outcome.message} />
        ) : (
          <Notice message={outcome.failure.message} detail={outcome.failure.detail} />
        )
      ) : null}

      {limitFailure ? <Notice message={limitFailure.message} detail={limitFailure.detail} /> : null}

      <div className="actions">
        {CONTROL_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              run(name)
            }}
          >
            {COMMANDS[name].label}
          </button>
        ))}
      </div>

      <div className="slider">
        <label className="slider-head" htmlFor="charge-limit">
          <span>Charge limit</span>
          <output htmlFor="charge-limit">{limit}%</output>
        </label>
        <input
          id="charge-limit"
          type="range"
          min={CHARGE_LIMIT.min}
          max={CHARGE_LIMIT.max}
          step={CHARGE_LIMIT.step}
          value={limit}
          disabled={busy}
          onChange={(event) => {
            setLimit(event.target.valueAsNumber)
          }}
          onPointerUp={commitLimit}
          onKeyUp={commitLimit}
        />
      </div>
    </>
  )
}
