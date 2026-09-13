/**
 * @file Vehicle list.
 *
 * The page shell renders immediately and the vehicle list streams in behind a
 * Suspense boundary, so a slow or sleeping fleet does not delay first paint.
 */

import Link from 'next/link'
import { Suspense } from 'react'
import { TeslaError } from 'tesdk'
import { signIn } from './actions.ts'
import { clientFromSession } from '../lib/session.ts'

/** Scopes shown on the sign-in screen so the ask is explicit. */
const REQUESTED_SCOPES = [
  'Profile information',
  'Vehicle information and location',
  'Vehicle commands',
  'Charging management',
] as const

function SignIn() {
  return (
    <div className="signin">
      <div className="signin-inner">
        <h1>Fleet</h1>
        <p>Connect your Tesla account to view and control your vehicles.</p>
        <form action={signIn}>
          <button type="submit" className="btn btn-primary">
            Sign in with Tesla
          </button>
        </form>
        <ul className="scopes">
          {REQUESTED_SCOPES.map((scope) => (
            <li key={scope}>{scope}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function VehicleSkeleton() {
  return (
    <div className="grid">
      {[0, 1].map((key) => (
        <div key={key} className="card">
          <div className="card-head">
            <h2 className="card-title">Loading…</h2>
          </div>
          <div className="track" />
        </div>
      ))}
    </div>
  )
}

/**
 * Renders the account's vehicles.
 *
 * Kept as a separate async component so the surrounding layout is not blocked
 * by the request.
 */
async function VehicleList() {
  const client = await clientFromSession()
  if (!client) return null

  let vehicles
  try {
    vehicles = await client.vehicles.list()
  } catch (error) {
    const message = error instanceof TeslaError ? error.message : 'Could not reach Fleet API.'
    return <p className="notice">{message}</p>
  }

  if (vehicles.length === 0) {
    return <div className="empty">No vehicles on this account.</div>
  }

  return (
    <div className="grid">
      {vehicles.map((vehicle) => (
        <Link key={vehicle.vin} href={`/vehicles/${vehicle.vin}`} className="card">
          <div className="card-head">
            <h2 className="card-title">{vehicle.display_name ?? 'Vehicle'}</h2>
            <span className="badge">
              <span className={`dot ${vehicle.state}`} />
              {vehicle.state}
            </span>
          </div>
          <span className="vin">{vehicle.vin}</span>
        </Link>
      ))}
    </div>
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  // Start the session read before awaiting searchParams so the two do not
  // serialize behind one another.
  const sessionPromise = clientFromSession()
  const { error } = await searchParams
  const client = await sessionPromise

  if (!client) return <SignIn />

  return (
    <main>
      <h1 className="page-title">Vehicles</h1>
      <p className="page-subtitle">Select a vehicle to view its status.</p>

      {error ? <p className="notice">{error}</p> : null}

      <Suspense fallback={<VehicleSkeleton />}>
        <VehicleList />
      </Suspense>
    </main>
  )
}
