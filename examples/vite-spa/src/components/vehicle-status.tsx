/**
 * @file Presentational pieces of a vehicle's live state.
 *
 * Pure functions of a {@link VehicleData} snapshot: no fetching, no SDK calls,
 * no state. Keeping them that way is what lets the detail screen render the
 * same battery gauge whether the data came from a fresh read or from a reload
 * after a command.
 */

import type { ChargeState, VehicleData, VehicleState } from '@bankkroll/tesdk'
import {
  formatDuration,
  formatPercent,
  formatPower,
  formatRange,
  formatTemp,
} from '../lib/format.ts'

/** Below this state of charge the gauge turns red. */
const LOW_BATTERY_PERCENT = 20

/**
 * Renders a connectivity dot and label.
 *
 * @param props.state - Connectivity state reported by Fleet API.
 */
export function StateBadge({ state }: { state: VehicleState }): React.JSX.Element {
  return (
    <span className="badge">
      <span className={`dot ${state}`} />
      {state}
    </span>
  )
}

/**
 * Renders the state-of-charge gauge and estimated range.
 *
 * @param props.charge - Charge subtree, absent when the vehicle is asleep.
 */
export function Battery({ charge }: { charge: ChargeState | undefined }): React.JSX.Element | null {
  if (!charge) return null

  const charging = charge.charging_state === 'Charging'
  const level = charge.battery_level

  return (
    <>
      <div className="battery-row">
        <span className="battery-pct">{level}%</span>
        <span className="battery-range">{formatRange(charge.battery_range)}</span>
      </div>
      <div
        className="track"
        role="meter"
        aria-label="State of charge"
        aria-valuenow={level}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`fill ${charging ? 'charging' : ''} ${level <= LOW_BATTERY_PERCENT ? 'low' : ''}`}
          style={{ width: `${level}%` }}
        />
      </div>
    </>
  )
}

/** Renders one labelled row. */
function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * Renders the charge and climate detail rows.
 *
 * @param props.data - Snapshot from `client.vehicles.data`.
 */
export function VehicleDetails({ data }: { data: VehicleData }): React.JSX.Element {
  const charge = data.charge_state
  const climate = data.climate_state
  const charging = charge?.charging_state === 'Charging'

  return (
    <dl className="rows">
      <Row label="Charging" value={charge?.charging_state ?? '—'} />
      <Row label="Charge limit" value={formatPercent(charge?.charge_limit_soc)} />
      <Row label="Charge rate" value={charging ? formatPower(charge.charger_power ?? 0) : '—'} />
      <Row
        label="Time to full"
        value={charging ? formatDuration(charge.minutes_to_full_charge) : '—'}
      />
      <Row label="Climate" value={climate ? (climate.is_climate_on ? 'On' : 'Off') : '—'} />
      <Row label="Inside" value={formatTemp(climate?.inside_temp)} />
      <Row label="Outside" value={formatTemp(climate?.outside_temp)} />
      <Row label="Set to" value={climate ? formatTemp(climate.driver_temp_setting) : '—'} />
    </dl>
  )
}
