'use client'

/**
 * @file Interactive controls for a single vehicle.
 *
 * One generic action button drives every command, so adding a control is a
 * one-line change to {@link CONTROLS} rather than new component code.
 */

import { useState, useTransition } from 'react'
import { runCommand, setChargeLimit, type ActionResult, type CommandName } from '../../actions.ts'

/** A button in the control grid. */
interface Control {
  name: CommandName
  label: string
}

/** Controls rendered for every vehicle, in display order. */
const CONTROLS: readonly Control[] = [
  { name: 'lock', label: 'Lock' },
  { name: 'unlock', label: 'Unlock' },
  { name: 'climateOn', label: 'Climate on' },
  { name: 'climateOff', label: 'Climate off' },
  { name: 'chargeStart', label: 'Start charge' },
  { name: 'chargeStop', label: 'Stop charge' },
  { name: 'flash', label: 'Flash lights' },
  { name: 'honk', label: 'Honk' },
  { name: 'wake', label: 'Wake' },
]

/** Props for {@link VehicleControls}. */
export interface VehicleControlsProps {
  vin: string
  /** Current charge limit, used as the slider's initial value. */
  chargeLimit: number | undefined
}

/**
 * Renders the command grid and the charge-limit slider.
 *
 * `useTransition` keeps the UI responsive while an action is in flight and
 * removes the need for a manual loading flag.
 */
export function VehicleControls({ vin, chargeLimit }: VehicleControlsProps): React.JSX.Element {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | undefined>(undefined)
  const [limit, setLimit] = useState(chargeLimit ?? 80)

  /** Runs an action inside a transition and records its outcome. */
  const run = (action: () => Promise<ActionResult>): void => {
    startTransition(async () => {
      setResult(await action())
    })
  }

  return (
    <>
      {result ? (
        <p className={`notice ${result.ok ? 'ok' : ''}`} role="status">
          {result.message}
        </p>
      ) : null}

      <div className="actions">
        {CONTROLS.map((control) => (
          <button
            key={control.name}
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => {
              run(() => runCommand(vin, control.name))
            }}
          >
            {control.label}
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
          min={50}
          max={100}
          step={5}
          value={limit}
          disabled={pending}
          onChange={(event) => {
            setLimit(event.target.valueAsNumber)
          }}
          onPointerUp={() => {
            run(() => setChargeLimit(vin, limit))
          }}
        />
      </div>
    </>
  )
}
