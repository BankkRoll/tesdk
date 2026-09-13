import { describe, expect, it, vi } from 'vitest'
import type { FetchLike } from '../src/index.js'
import { TeslaClient, publicKeyUrl, virtualKeyPairingUrl } from '../src/index.js'

/** Captures the single request a call makes and returns its URL and body. */
async function capture(
  run: (client: TeslaClient) => Promise<unknown>,
): Promise<{ url: string; method: string; body: unknown }> {
  const fetchMock = vi.fn<FetchLike>(
    async () =>
      new Response(JSON.stringify({ response: {} }), {
        headers: { 'content-type': 'application/json' },
      }),
  )
  await run(new TeslaClient({ accessToken: 't', fetch: fetchMock }))
  const [url, init] = fetchMock.mock.calls[0] ?? []
  return {
    url: decodeURIComponent(String(url)),
    method: String(init?.method),
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }
}

describe('energy', () => {
  it('passes the range and time zone to the history endpoint', async () => {
    const { url } = await capture((c) =>
      c.energy.energyHistory(123, 'day', {
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-01-31T00:00:00Z',
        timeZone: 'America/Los_Angeles',
      }),
    )
    expect(url).toContain('/energy_sites/123/calendar_history')
    expect(url).toContain('kind=energy')
    expect(url).toContain('period=day')
    expect(url).toContain('time_zone=America/Los_Angeles')
  })

  it('nests the tariff under tou_settings.tariff_content_v2', async () => {
    const { body } = await capture((c) => c.energy.setTimeOfUseSettings(1, { seasons: {} }))
    expect(body).toEqual({ tou_settings: { tariff_content_v2: { seasons: {} } } })
  })

  it('sends the backup reserve percentage', async () => {
    const { body, method } = await capture((c) => c.energy.setBackupReserve(1, 30))
    expect(method).toBe('POST')
    expect(body).toEqual({ backup_reserve_percent: 30 })
  })
})

describe('fleet status', () => {
  it('posts the VIN batch', async () => {
    const { url, method, body } = await capture((c) => c.vehicles.fleetStatus(['VIN1', 'VIN2']))
    expect(method).toBe('POST')
    expect(url).toContain('/api/1/vehicles/fleet_status')
    expect(body).toEqual({ vins: ['VIN1', 'VIN2'] })
  })

  it('rejects a malformed VIN in the batch', async () => {
    const client = new TeslaClient({ accessToken: 't', fetch: vi.fn<FetchLike>() })
    await expect(client.vehicles.fleetStatus(['ok', '../bad'])).rejects.toBeInstanceOf(TypeError)
  })
})

describe('telemetry', () => {
  it('sends the config alongside the VINs', async () => {
    const config = {
      hostname: 'telemetry.example.com',
      ca: '-----BEGIN CERTIFICATE-----',
      fields: { Soc: { interval_seconds: 60 } },
    }
    const { url, body } = await capture((c) => c.telemetry.createConfig(['VIN1'], config))
    expect(url).toContain('/api/1/vehicles/fleet_telemetry_config')
    expect(body).toEqual({ vins: ['VIN1'], config })
  })

  it('deletes a per-vehicle config', async () => {
    const { url, method } = await capture((c) => c.telemetry.deleteConfig('VIN1'))
    expect(method).toBe('DELETE')
    expect(url).toContain('/api/1/vehicles/VIN1/fleet_telemetry_config')
  })
})

describe('commands with parameters', () => {
  it('defaults window coordinates when none are supplied', async () => {
    const { body } = await capture((c) => c.commands.windowControl('VIN1', 'vent'))
    expect(body).toEqual({ command: 'vent', lat: 0, lon: 0 })
  })

  it('forwards the user position when closing windows', async () => {
    const { body } = await capture((c) =>
      c.commands.windowControl('VIN1', 'close', { lat: 37.4, lon: -122.1 }),
    )
    expect(body).toEqual({ command: 'close', lat: 37.4, lon: -122.1 })
  })

  it('maps a seat position to the heater request', async () => {
    const { body } = await capture((c) => c.commands.setSeatHeater('VIN1', 1, 3))
    expect(body).toEqual({ heater: 1, level: 3 })
  })

  it('mirrors the driver temperature to the passenger side by default', async () => {
    const { body } = await capture((c) => c.commands.setTemps('VIN1', { driverTemp: 21 }))
    expect(body).toEqual({ driver_temp: 21, passenger_temp: 21 })
  })
})

describe('partner', () => {
  it('registers a domain', async () => {
    const { url, method, body } = await capture((c) => c.partner.register('example.com'))
    expect(method).toBe('POST')
    expect(url).toContain('/api/1/partner_accounts')
    expect(body).toEqual({ domain: 'example.com' })
  })
})

describe('virtual keys', () => {
  it('builds a pairing link, with an optional VIN', () => {
    expect(virtualKeyPairingUrl({ domain: 'example.com' })).toBe(
      'https://tesla.com/_ak/example.com',
    )
    expect(virtualKeyPairingUrl({ domain: 'https://example.com/', vin: 'VIN1' })).toBe(
      'https://tesla.com/_ak/example.com?vin=VIN1',
    )
  })

  it('builds the well-known public key URL', () => {
    expect(publicKeyUrl('example.com')).toBe(
      'https://example.com/.well-known/appspecific/com.tesla.3p.public-key.pem',
    )
  })
})
