/**
 * @file Vehicle list screen.
 *
 * Lists vehicles from the cheap `/api/1/vehicles` endpoint, which reports
 * connectivity without waking anything. The expensive `vehicle_data` read is
 * deferred to the detail screen, so opening the app never disturbs a sleeping
 * fleet.
 */

import type { TeslaClient } from '@bankkroll/tesdk'
import { useAsync } from '../hooks/use-async.ts'
import { FailureNotice } from './notice.tsx'
import { StateBadge } from './vehicle-status.tsx'

/** Props for {@link VehicleList}. */
export interface VehicleListProps {
  client: TeslaClient
  /** Navigates to a vehicle's detail screen. */
  onOpen: (vin: string) => void
}

/**
 * Renders the account's vehicles as a card grid.
 *
 * @param props - See {@link VehicleListProps}.
 */
export function VehicleList({ client, onOpen }: VehicleListProps): React.JSX.Element {
  const { data, loading, failure } = useAsync(
    (signal) => client.vehicles.list({ signal }),
    [client],
  )

  return (
    <main>
      <h1 className="page-title">Vehicles</h1>
      <p className="page-subtitle">Select a vehicle to view its status.</p>

      <FailureNotice failure={failure} />

      {loading && !data ? <div className="skeleton">Loading</div> : null}

      {data?.length === 0 ? <div className="empty">No vehicles on this account.</div> : null}

      {data && data.length > 0 ? (
        <div className="grid">
          {data.map((vehicle) => (
            <button
              key={vehicle.vin}
              type="button"
              className="card"
              onClick={() => {
                onOpen(vehicle.vin)
              }}
            >
              <div className="card-head">
                <h2 className="card-title">{vehicle.display_name ?? 'Vehicle'}</h2>
                <StateBadge state={vehicle.state} />
              </div>
              <span className="vin">{vehicle.vin}</span>
            </button>
          ))}
        </div>
      ) : null}
    </main>
  )
}
