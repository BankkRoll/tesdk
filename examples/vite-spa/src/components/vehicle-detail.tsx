/**
 * @file Vehicle detail screen.
 *
 * Two reads with different costs: the summary from `/api/1/vehicles/{vin}`
 * never wakes the car, while `vehicle_data` does and is billed per call. They
 * are kept separate so the header and the controls appear even when the live
 * read fails, which is the common case for a sleeping vehicle.
 *
 * `VehicleAsleepError` is treated as a state, not a failure: the screen offers
 * a wake button instead of an error page.
 */

import { useCallback } from 'react'
import type { TeslaClient } from '@bankkroll/tesdk'
import { useAsync } from '../hooks/use-async.ts'
import { useCommand } from '../hooks/use-command.ts'
import { FailureNotice, Notice } from './notice.tsx'
import { VehicleControls } from './vehicle-controls.tsx'
import { Battery, StateBadge, VehicleDetails } from './vehicle-status.tsx'

/** Subtrees the screen renders. Narrowing the request shortens the wake. */
const ENDPOINTS = ['charge_state', 'climate_state'] as const

/** Props for {@link VehicleDetail}. */
export interface VehicleDetailProps {
  client: TeslaClient
  vin: string
  /** Returns to the vehicle list. */
  onBack: () => void
}

/**
 * Renders live status and controls for one vehicle.
 *
 * @param props - See {@link VehicleDetailProps}.
 */
export function VehicleDetail({ client, vin, onBack }: VehicleDetailProps): React.JSX.Element {
  const summary = useAsync((signal) => client.vehicles.get(vin, { signal }), [client, vin])

  const live = useAsync(
    (signal) => client.vehicles.data(vin, { endpoints: [...ENDPOINTS], signal }),
    [client, vin],
  )

  const reload = useCallback(() => {
    summary.reload()
    live.reload()
  }, [summary, live])

  // The wake button is a command like any other, so it shares the runner and
  // reports rejections and signing requirements the same way.
  const wake = useCommand(client, vin, reload)

  const wakeAction = live.failure?.wakeable ? (
    <div className="actions">
      <button
        type="button"
        className="btn btn-primary"
        disabled={wake.pending}
        onClick={() => {
          wake.run('wake')
        }}
      >
        {wake.pending ? 'Waking…' : 'Wake'}
      </button>
    </div>
  ) : null

  return (
    <main>
      <button type="button" className="back" onClick={onBack}>
        ← Vehicles
      </button>

      <h1 className="page-title">{summary.data?.display_name ?? 'Vehicle'}</h1>
      <p className="page-subtitle">
        {summary.data ? <StateBadge state={summary.data.state} /> : null}
        <span className="vin"> · {vin}</span>
      </p>

      <FailureNotice failure={summary.data ? undefined : summary.failure} />

      {wake.outcome?.status === 'failed' ? (
        <Notice message={wake.outcome.failure.message} detail={wake.outcome.failure.detail} />
      ) : null}

      <FailureNotice failure={live.failure}>{wakeAction}</FailureNotice>

      {live.loading && !live.data ? <div className="skeleton">Reading vehicle</div> : null}

      {live.data ? (
        <>
          <Battery charge={live.data.charge_state} />
          <VehicleDetails data={live.data} />
        </>
      ) : null}

      <VehicleControls
        client={client}
        vin={vin}
        chargeLimit={live.data?.charge_state?.charge_limit_soc}
        onSettled={reload}
      />
    </main>
  )
}
