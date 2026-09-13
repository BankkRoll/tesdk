/**
 * Verifies that every resource method issues the documented request: correct
 * verb, path, and retry disposition.
 */

import { describe, expect, it, vi } from 'vitest'
import type { FetchLike } from '../src/index.js'
import { SeatPosition, TeslaClient } from '../src/index.js'

const VIN = '5YJ3E1EA1JF000000'

interface Captured {
  method: string
  path: string
  query: URLSearchParams
  body: Record<string, unknown> | undefined
}

/** Runs one call against a stub and reports the request it produced. */
async function call(run: (client: TeslaClient) => Promise<unknown>): Promise<Captured> {
  const fetchMock = vi.fn<FetchLike>(
    async () =>
      new Response(JSON.stringify({ response: {} }), {
        headers: { 'content-type': 'application/json' },
      }),
  )

  await run(new TeslaClient({ accessToken: 't', fetch: fetchMock }))

  const [rawUrl, init] = fetchMock.mock.calls[0] ?? []
  const url = new URL(String(rawUrl))
  return {
    method: String(init?.method),
    path: url.pathname,
    query: url.searchParams,
    body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
  }
}

/** Reports whether a failing call was retried. */
async function attemptsFor(run: (client: TeslaClient) => Promise<unknown>): Promise<number> {
  const fetchMock = vi.fn<FetchLike>(
    async () =>
      new Response(JSON.stringify({ error: 'boom' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
  )

  const client = new TeslaClient({
    accessToken: 't',
    fetch: fetchMock,
    retry: { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 1 },
  })

  await run(client).catch(() => undefined)
  return fetchMock.mock.calls.length
}

describe('vehicle endpoints', () => {
  it.each([
    ['get', (c: TeslaClient) => c.vehicles.get(VIN), 'GET', `/api/1/vehicles/${VIN}`],
    [
      'data',
      (c: TeslaClient) => c.vehicles.data(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/vehicle_data`,
    ],
    [
      'wakeUp',
      (c: TeslaClient) => c.vehicles.wakeUp(VIN),
      'POST',
      `/api/1/vehicles/${VIN}/wake_up`,
    ],
    [
      'drivers',
      (c: TeslaClient) => c.vehicles.drivers(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/drivers`,
    ],
    [
      'mobileEnabled',
      (c: TeslaClient) => c.vehicles.mobileEnabled(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/mobile_enabled`,
    ],
    [
      'nearbyChargingSites',
      (c: TeslaClient) => c.vehicles.nearbyChargingSites(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/nearby_charging_sites`,
    ],
    [
      'recentAlerts',
      (c: TeslaClient) => c.vehicles.recentAlerts(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/recent_alerts`,
    ],
    [
      'serviceData',
      (c: TeslaClient) => c.vehicles.serviceData(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/service_data`,
    ],
    ['specs', (c: TeslaClient) => c.vehicles.specs(VIN), 'GET', `/api/1/vehicles/${VIN}/specs`],
    [
      'releaseNotes',
      (c: TeslaClient) => c.vehicles.releaseNotes(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/release_notes`,
    ],
    [
      'shareInvites',
      (c: TeslaClient) => c.vehicles.shareInvites(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/invitations`,
    ],
    [
      'createShareInvite',
      (c: TeslaClient) => c.vehicles.createShareInvite(VIN),
      'POST',
      `/api/1/vehicles/${VIN}/invitations`,
    ],
    [
      'redeemShareInvite',
      (c: TeslaClient) => c.vehicles.redeemShareInvite('code'),
      'POST',
      '/api/1/invitations/redeem',
    ],
  ])('%s', async (_name, run, method, path) => {
    const request = await call(run)
    expect(request.method).toBe(method)
    expect(request.path).toBe(path)
  })

  it('removeDriver passes the share user id', async () => {
    const request = await call((c) => c.vehicles.removeDriver(VIN, 42))
    expect(request.method).toBe('DELETE')
    expect(request.query.get('share_user_id')).toBe('42')
  })

  it('revokeShareInvite encodes the invitation id', async () => {
    const request = await call((c) => c.vehicles.revokeShareInvite(VIN, 'a/b'))
    expect(request.path).toBe(`/api/1/vehicles/${VIN}/invitations/a%2Fb/revoke`)
  })
})

describe('command retry policy', () => {
  it.each([
    ['honkHorn', (c: TeslaClient) => c.commands.honkHorn(VIN)],
    ['flashLights', (c: TeslaClient) => c.commands.flashLights(VIN)],
    ['actuateTrunk', (c: TeslaClient) => c.commands.actuateTrunk(VIN, 'rear')],
    ['mediaNextTrack', (c: TeslaClient) => c.commands.mediaNextTrack(VIN)],
    ['mediaPrevTrack', (c: TeslaClient) => c.commands.mediaPrevTrack(VIN)],
    ['mediaTogglePlayback', (c: TeslaClient) => c.commands.mediaTogglePlayback(VIN)],
    ['remoteBoombox', (c: TeslaClient) => c.commands.remoteBoombox(VIN, 2000)],
    ['triggerHomelink', (c: TeslaClient) => c.commands.triggerHomelink(VIN, { lat: 1, lon: 2 })],
    ['createShareInvite', (c: TeslaClient) => c.vehicles.createShareInvite(VIN)],
  ])('%s is never retried', async (_name, run) => {
    expect(await attemptsFor(run)).toBe(1)
  })

  it.each([
    ['doorLock', (c: TeslaClient) => c.commands.doorLock(VIN)],
    ['doorUnlock', (c: TeslaClient) => c.commands.doorUnlock(VIN)],
    ['chargeStart', (c: TeslaClient) => c.commands.chargeStart(VIN)],
    ['setChargeLimit', (c: TeslaClient) => c.commands.setChargeLimit(VIN, 80)],
    ['setSentryMode', (c: TeslaClient) => c.commands.setSentryMode(VIN, true)],
    ['climateStart', (c: TeslaClient) => c.commands.climateStart(VIN)],
  ])('%s is retried', async (_name, run) => {
    expect(await attemptsFor(run)).toBe(2)
  })
})

describe('command payloads', () => {
  it.each([
    [
      'setChargingAmps',
      (c: TeslaClient) => c.commands.setChargingAmps(VIN, 16),
      { charging_amps: 16 },
    ],
    ['setSentryMode', (c: TeslaClient) => c.commands.setSentryMode(VIN, true), { on: true }],
    [
      'setClimateKeeperMode',
      (c: TeslaClient) => c.commands.setClimateKeeperMode(VIN, 2),
      { climate_keeper_mode: 2 },
    ],
    [
      'speedLimitSetLimit',
      (c: TeslaClient) => c.commands.speedLimitSetLimit(VIN, 70),
      { limit_mph: 70 },
    ],
    ['adjustVolume', (c: TeslaClient) => c.commands.adjustVolume(VIN, 5), { volume: 5 }],
    [
      'sunRoofControl',
      (c: TeslaClient) => c.commands.sunRoofControl(VIN, 'vent'),
      { state: 'vent' },
    ],
    [
      'actuateTrunk',
      (c: TeslaClient) => c.commands.actuateTrunk(VIN, 'front'),
      { which_trunk: 'front' },
    ],
    [
      'removeChargeSchedule',
      (c: TeslaClient) => c.commands.removeChargeSchedule(VIN, 7),
      { id: 7 },
    ],
    ['setGuestMode', (c: TeslaClient) => c.commands.setGuestMode(VIN, true), { enable: true }],
    [
      'setValetMode',
      (c: TeslaClient) => c.commands.setValetMode(VIN, true, '1234'),
      { on: true, password: '1234' },
    ],
    [
      'setCabinOverheatProtection',
      (c: TeslaClient) => c.commands.setCabinOverheatProtection(VIN, { on: true }),
      { on: true, fan_only: false },
    ],
    [
      'setSeatHeater',
      (c: TeslaClient) => c.commands.setSeatHeater(VIN, SeatPosition.RearLeft, 2),
      { heater: 2, level: 2 },
    ],
    [
      'scheduleSoftwareUpdate',
      (c: TeslaClient) => c.commands.scheduleSoftwareUpdate(VIN, 0),
      { offset_sec: 0 },
    ],
    [
      'setPinToDrive',
      (c: TeslaClient) => c.commands.setPinToDrive(VIN, '1234'),
      { on: true, password: '1234' },
    ],
    [
      'navigationGpsRequest',
      (c: TeslaClient) => c.commands.navigationGpsRequest(VIN, { lat: 1, lon: 2 }),
      { lat: 1, lon: 2 },
    ],
  ])('%s', async (_name, run, expected) => {
    const request = await call(run)
    expect(request.method).toBe('POST')
    expect(request.body).toEqual(expected)
  })

  it('setVehicleName sends the name', async () => {
    const request = await call((c) => c.commands.setVehicleName(VIN, 'Kitt'))
    expect(request.path).toBe(`/api/1/vehicles/${VIN}/command/set_vehicle_name`)
    expect(request.body).toEqual({ vehicle_name: 'Kitt' })
  })

  it('resetPinToDrive sends no body', async () => {
    const request = await call((c) => c.commands.resetPinToDrive(VIN))
    expect(request.body).toBeUndefined()
  })

  it('signedCommand posts the envelope to the generic endpoint', async () => {
    const request = await call((c) => c.commands.signedCommand(VIN, { signed: 'payload' }))
    expect(request.method).toBe('POST')
    expect(request.path).toBe(`/api/1/vehicles/${VIN}/signed_command`)
    expect(request.body).toEqual({ signed: 'payload' })
  })

  it('signedCommand is not retried by default', async () => {
    expect(await attemptsFor((c) => c.commands.signedCommand(VIN, {}))).toBe(1)
  })

  it.each([
    [
      'chargePortDoorOpen',
      (c: TeslaClient) => c.commands.chargePortDoorOpen(VIN),
      'charge_port_door_open',
      undefined,
    ],
    [
      'chargePortDoorClose',
      (c: TeslaClient) => c.commands.chargePortDoorClose(VIN),
      'charge_port_door_close',
      undefined,
    ],
    [
      'climateStop',
      (c: TeslaClient) => c.commands.climateStop(VIN),
      'auto_conditioning_stop',
      undefined,
    ],
    [
      'remoteStartDrive',
      (c: TeslaClient) => c.commands.remoteStartDrive(VIN),
      'remote_start_drive',
      undefined,
    ],
    [
      'cancelSoftwareUpdate',
      (c: TeslaClient) => c.commands.cancelSoftwareUpdate(VIN),
      'cancel_software_update',
      undefined,
    ],
    [
      'setBioweaponMode',
      (c: TeslaClient) => c.commands.setBioweaponMode(VIN, true),
      'set_bioweapon_mode',
      { on: true, manual_override: true },
    ],
    [
      'speedLimitActivate',
      (c: TeslaClient) => c.commands.speedLimitActivate(VIN, '1234'),
      'speed_limit_activate',
      { pin: '1234' },
    ],
    [
      'speedLimitDeactivate',
      (c: TeslaClient) => c.commands.speedLimitDeactivate(VIN, '1234'),
      'speed_limit_deactivate',
      { pin: '1234' },
    ],
    [
      'navigationSuperchargerRequest',
      (c: TeslaClient) => c.commands.navigationSuperchargerRequest(VIN, 99),
      'navigation_sc_request',
      { id: 99, order: 0 },
    ],
    [
      'addChargeSchedule',
      (c: TeslaClient) => c.commands.addChargeSchedule(VIN, { days_of_week: 'Mon' }),
      'add_charge_schedule',
      { days_of_week: 'Mon' },
    ],
    [
      'addPreconditionSchedule',
      (c: TeslaClient) => c.commands.addPreconditionSchedule(VIN, { enabled: true }),
      'add_precondition_schedule',
      { enabled: true },
    ],
    [
      'removePreconditionSchedule',
      (c: TeslaClient) => c.commands.removePreconditionSchedule(VIN, 3),
      'remove_precondition_schedule',
      { id: 3 },
    ],
  ])('%s posts to command/%s', async (_name, run, command, body) => {
    const request = await call(run)
    expect(request.method).toBe('POST')
    expect(request.path).toBe(`/api/1/vehicles/${VIN}/command/${command}`)
    expect(request.body).toEqual(body)
  })

  it('navigationRequest wraps the destination in the share payload', async () => {
    const request = await call((c) => c.commands.navigationRequest(VIN, '1 Main St'))
    expect(request.path).toBe(`/api/1/vehicles/${VIN}/command/navigation_request`)
    expect(request.body).toMatchObject({
      type: 'share_ext_content_raw',
      value: { 'android.intent.extra.TEXT': '1 Main St' },
      locale: 'en-US',
    })
    expect(typeof request.body?.['timestamp_ms']).toBe('string')
  })

  it('setValetMode omits the password when none is given', async () => {
    const request = await call((c) => c.commands.setValetMode(VIN, false))
    expect(request.body).toEqual({ on: false })
  })

  it('setTemps honours a distinct passenger temperature', async () => {
    const request = await call((c) =>
      c.commands.setTemps(VIN, { driverTemp: 20, passengerTemp: 23 }),
    )
    expect(request.body).toEqual({ driver_temp: 20, passenger_temp: 23 })
  })

  it('setCabinOverheatProtection forwards fanOnly', async () => {
    const request = await call((c) =>
      c.commands.setCabinOverheatProtection(VIN, { on: true, fanOnly: true }),
    )
    expect(request.body).toEqual({ on: true, fan_only: true })
  })

  it('navigationGpsRequest passes a stop order', async () => {
    const request = await call((c) =>
      c.commands.navigationGpsRequest(VIN, { lat: 1, lon: 2, order: 3 }),
    )
    expect(request.body).toEqual({ lat: 1, lon: 2, order: 3 })
  })

  it('send surfaces an unknown rejection reason', async () => {
    const fetchMock = vi.fn<FetchLike>(
      async () =>
        new Response(JSON.stringify({ response: { result: false } }), {
          headers: { 'content-type': 'application/json' },
        }),
    )
    const client = new TeslaClient({ accessToken: 't', fetch: fetchMock })

    await expect(
      client.commands.send(VIN, 'door_lock', undefined, { throwOnFailure: true }),
    ).rejects.toThrow(/unknown reason/)
  })
})

describe('energy endpoints', () => {
  it.each([
    ['products', (c: TeslaClient) => c.energy.products(), 'GET', '/api/1/products'],
    [
      'liveStatus',
      (c: TeslaClient) => c.energy.liveStatus(1),
      'GET',
      '/api/1/energy_sites/1/live_status',
    ],
    [
      'siteInfo',
      (c: TeslaClient) => c.energy.siteInfo(1),
      'GET',
      '/api/1/energy_sites/1/site_info',
    ],
    [
      'chargeHistory',
      (c: TeslaClient) => c.energy.chargeHistory(1),
      'GET',
      '/api/1/energy_sites/1/telemetry_history',
    ],
    [
      'setStormMode',
      (c: TeslaClient) => c.energy.setStormMode(1, true),
      'POST',
      '/api/1/energy_sites/1/storm_mode',
    ],
    [
      'setOperationMode',
      (c: TeslaClient) => c.energy.setOperationMode(1, 'autonomous'),
      'POST',
      '/api/1/energy_sites/1/operation',
    ],
    [
      'setOffGridVehicleChargingReserve',
      (c: TeslaClient) => c.energy.setOffGridVehicleChargingReserve(1, 20),
      'POST',
      '/api/1/energy_sites/1/off_grid_vehicle_charging_reserve',
    ],
    [
      'setGridImportExport',
      (c: TeslaClient) =>
        c.energy.setGridImportExport(1, { customer_preferred_export_rule: 'pv_only' }),
      'POST',
      '/api/1/energy_sites/1/grid_import_export',
    ],
    [
      'backupHistory',
      (c: TeslaClient) => c.energy.backupHistory(1, 'week'),
      'GET',
      '/api/1/energy_sites/1/calendar_history',
    ],
  ])('%s', async (_name, run, method, path) => {
    const request = await call(run)
    expect(request.method).toBe(method)
    expect(request.path).toBe(path)
  })
})

describe('account and partner endpoints', () => {
  it.each([
    ['user.me', (c: TeslaClient) => c.user.me(), 'GET', '/api/1/users/me'],
    ['user.region', (c: TeslaClient) => c.user.region(), 'GET', '/api/1/users/region'],
    ['user.orders', (c: TeslaClient) => c.user.orders(), 'GET', '/api/1/users/orders'],
    [
      'user.featureConfig',
      (c: TeslaClient) => c.user.featureConfig(),
      'GET',
      '/api/1/users/feature_config',
    ],
    [
      'charging.history',
      (c: TeslaClient) => c.charging.history(),
      'GET',
      '/api/1/dx/charging/history',
    ],
    [
      'charging.sessions',
      (c: TeslaClient) => c.charging.sessions(),
      'GET',
      '/api/1/dx/charging/sessions',
    ],
    [
      'partner.publicKey',
      (c: TeslaClient) => c.partner.publicKey('example.com'),
      'GET',
      '/api/1/partner_accounts/public_key',
    ],
    [
      'partner.fleetTelemetryErrors',
      (c: TeslaClient) => c.partner.fleetTelemetryErrors(),
      'GET',
      '/api/1/partner_accounts/fleet_telemetry_errors',
    ],
    [
      'partner.fleetTelemetryErrorVins',
      (c: TeslaClient) => c.partner.fleetTelemetryErrorVins(),
      'GET',
      '/api/1/partner_accounts/fleet_telemetry_error_vins',
    ],
    [
      'fleet.options',
      (c: TeslaClient) => c.fleet.options(VIN),
      'GET',
      '/api/1/dx/vehicles/options',
    ],
    [
      'fleet.eligibleSubscriptions',
      (c: TeslaClient) => c.fleet.eligibleSubscriptions(VIN),
      'GET',
      '/api/1/dx/vehicles/subscriptions/eligibility',
    ],
    [
      'fleet.eligibleUpgrades',
      (c: TeslaClient) => c.fleet.eligibleUpgrades(VIN),
      'GET',
      '/api/1/dx/vehicles/upgrades/eligibility',
    ],
    [
      'fleet.warrantyDetails',
      (c: TeslaClient) => c.fleet.warrantyDetails(VIN),
      'GET',
      '/api/1/dx/warranty/details',
    ],
    [
      'fleet.pricing',
      (c: TeslaClient) => c.fleet.pricing({ market: 'US', model: 'm3' }),
      'POST',
      '/api/1/dx/vehicles/pricing',
    ],
    [
      'fleet.enterpriseRoles',
      (c: TeslaClient) => c.fleet.enterpriseRoles(VIN),
      'GET',
      `/api/1/dx/enterprise/v1/${VIN}/roles`,
    ],
    [
      'fleet.setEnterprisePayer',
      (c: TeslaClient) => c.fleet.setEnterprisePayer(VIN, { payer: 'acct' }),
      'POST',
      `/api/1/dx/enterprise/v1/${VIN}/payer`,
    ],
    [
      'telemetry.getConfig',
      (c: TeslaClient) => c.telemetry.getConfig(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/fleet_telemetry_config`,
    ],
    [
      'telemetry.errors',
      (c: TeslaClient) => c.telemetry.errors(VIN),
      'GET',
      `/api/1/vehicles/${VIN}/fleet_telemetry_errors`,
    ],
    [
      'telemetry.createConfigJws',
      (c: TeslaClient) => c.telemetry.createConfigJws('jws'),
      'POST',
      '/api/1/vehicles/fleet_telemetry_config_jws',
    ],
  ])('%s', async (_name, run, method, path) => {
    const request = await call(run)
    expect(request.method).toBe(method)
    expect(request.path).toBe(path)
  })

  it('fleet.options rejects a malformed VIN', async () => {
    const client = new TeslaClient({ accessToken: 't', fetch: vi.fn<FetchLike>() })
    await expect(client.fleet.options('../bad')).rejects.toBeInstanceOf(TypeError)
  })
})

describe('OCPI endpoints', () => {
  /** OCPI nests payloads under `data` rather than `response`. */
  async function ocpiCall(
    run: (client: TeslaClient) => Promise<unknown>,
    data: unknown = [],
  ): Promise<Captured> {
    const fetchMock = vi.fn<FetchLike>(
      async () =>
        new Response(JSON.stringify({ data, status_code: 1000 }), {
          headers: { 'content-type': 'application/json' },
        }),
    )

    await run(
      new TeslaClient({ baseUrl: 'https://ocpi.example.com', ocpiToken: 'k', fetch: fetchMock }),
    )

    const [rawUrl, init] = fetchMock.mock.calls[0] ?? []
    const url = new URL(String(rawUrl))
    return {
      method: String(init?.method),
      path: url.pathname,
      query: url.searchParams,
      body: undefined,
    }
  }

  it('lists locations with paging parameters', async () => {
    const request = await ocpiCall((c) => c.ocpi.locations({ offset: 10, limit: 5 }))
    expect(request.path).toBe('/ocpi/cpo/2.2.1/locations')
    expect(request.query.get('offset')).toBe('10')
    expect(request.query.get('limit')).toBe('5')
  })

  it('encodes a location id', async () => {
    const request = await ocpiCall((c) => c.ocpi.location('a b'), {})
    expect(request.path).toBe('/ocpi/cpo/2.2.1/locations/a%20b')
  })

  it('lists tariffs', async () => {
    const request = await ocpiCall((c) => c.ocpi.tariffs())
    expect(request.path).toBe('/ocpi/cpo/2.2.1/tariffs')
  })

  it('reads version details and credentials', async () => {
    expect((await ocpiCall((c) => c.ocpi.versionDetails(), {})).path).toBe('/ocpi/cpo/2.2.1')
    expect((await ocpiCall((c) => c.ocpi.credentials(), {})).path).toBe('/ocpi/2.2.1/credentials')
  })

  it('stops iterating on a short page', async () => {
    const pages = [[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }]]
    const fetchMock = vi.fn<FetchLike>(
      async () =>
        new Response(JSON.stringify({ data: pages.shift() ?? [], status_code: 1000 }), {
          headers: { 'content-type': 'application/json' },
        }),
    )

    const client = new TeslaClient({
      baseUrl: 'https://ocpi.example.com',
      ocpiToken: 'k',
      fetch: fetchMock,
    })

    const ids: string[] = []
    for await (const location of client.ocpi.listAllLocations({ limit: 2 })) ids.push(location.id)

    expect(ids).toEqual(['a', 'b', 'c'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
