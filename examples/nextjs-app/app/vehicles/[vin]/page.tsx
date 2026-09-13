/**
 * @file Vehicle detail: live status and controls.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { NotFoundError, TeslaError, VehicleAsleepError } from 'tesdk'
import type { VehicleData } from 'tesdk'
import { clientFromSession } from '../../../lib/session.ts'
import { VehicleControls } from './controls.tsx'

/** Converts Tesla's miles to a display string with a metric equivalent. */
function formatRange(miles: number | undefined): string {
  if (miles === undefined) return '—'
  return `${Math.round(miles)} mi · ${Math.round(miles * 1.60934)} km`
}

/** Renders a labelled row, skipping rows with no value. */
function Row({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/** Renders the battery gauge. */
function Battery({ data }: { data: VehicleData }) {
  const charge = data.charge_state
  if (!charge) return null

  const charging = charge.charging_state === 'Charging'
  const level = charge.battery_level

  return (
    <>
      <div className="battery-row">
        <span className="battery-pct">{level}%</span>
        <span className="battery-range">{formatRange(charge.battery_range)}</span>
      </div>
      <div className="track">
        <div
          className={`fill ${charging ? 'charging' : ''} ${level <= 20 ? 'low' : ''}`}
          style={{ width: `${level}%` }}
        />
      </div>
    </>
  )
}

/** Renders the charge, climate, and drive detail rows. */
function Details({ data }: { data: VehicleData }) {
  const { charge_state: charge, climate_state: climate, drive_state: drive } = data

  const inside = climate?.inside_temp
  const outside = climate?.outside_temp
  const position =
    drive?.latitude !== undefined && drive.longitude !== undefined
      ? `${drive.latitude.toFixed(4)}, ${drive.longitude.toFixed(4)}`
      : undefined

  return (
    <dl className="rows">
      <Row label="Charging" value={charge?.charging_state} />
      <Row
        label="Charge limit"
        value={charge?.charge_limit_soc === undefined ? undefined : `${charge.charge_limit_soc}%`}
      />
      <Row
        label="Charge rate"
        value={charge?.charging_state === 'Charging' ? `${charge.charger_power ?? 0} kW` : undefined}
      />
      <Row label="Climate" value={climate ? (climate.is_climate_on ? 'On' : 'Off') : undefined} />
      <Row label="Inside" value={inside === null || inside === undefined ? undefined : `${inside}°C`} />
      <Row
        label="Outside"
        value={outside === null || outside === undefined ? undefined : `${outside}°C`}
      />
      <Row label="Gear" value={drive?.shift_state ?? undefined} />
      <Row label="Location" value={position} />
    </dl>
  )
}

/**
 * Loads and renders live vehicle data.
 *
 * Split from the page so the header renders before this request settles.
 */
async function LiveStatus({ vin }: { vin: string }) {
  const client = await clientFromSession()
  if (!client) return null

  try {
    const data = await client.vehicles.data(vin)
    return (
      <>
        <Battery data={data} />
        <Details data={data} />
        <VehicleControls vin={vin} chargeLimit={data.charge_state?.charge_limit_soc} />
      </>
    )
  } catch (error) {
    // A sleeping vehicle is expected, not a failure: show the controls so the
    // visitor can wake it rather than an error page.
    if (error instanceof VehicleAsleepError) {
      return (
        <>
          <p className="notice">This vehicle is asleep. Wake it to read live data.</p>
          <VehicleControls vin={vin} chargeLimit={undefined} />
        </>
      )
    }

    if (error instanceof NotFoundError) notFound()

    return (
      <p className="notice">
        {error instanceof TeslaError ? error.message : 'Could not reach the vehicle.'}
      </p>
    )
  }
}

export default async function VehiclePage({ params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params

  const client = await clientFromSession()
  if (!client) {
    return (
      <main>
        <p className="notice">Your session expired. Return home to sign in again.</p>
        <Link href="/" className="btn btn-primary">
          Home
        </Link>
      </main>
    )
  }

  const vehicle = await client.vehicles.get(vin).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound()
    throw error
  })

  return (
    <main>
      <Link href="/" className="back">
        ← Vehicles
      </Link>

      <h1 className="page-title">{vehicle.display_name ?? 'Vehicle'}</h1>
      <p className="page-subtitle">
        <span className="badge">
          <span className={`dot ${vehicle.state}`} />
          {vehicle.state}
        </span>
        <span className="vin"> · {vehicle.vin}</span>
      </p>

      <Suspense fallback={<div className="track" />}>
        <LiveStatus vin={vin} />
      </Suspense>
    </main>
  )
}
