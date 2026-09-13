import { describe, expect, it, vi } from 'vitest'
import type { FetchLike } from '../src/index.js'
import { TeslaClient, TimeoutError } from '../src/index.js'

/** Builds a JSON `Response` wrapped in the Fleet API envelope. */
function envelope(response: unknown, pagination?: unknown): Response {
  return new Response(JSON.stringify({ response, pagination }), {
    headers: { 'content-type': 'application/json' },
  })
}

/** Builds a vehicle summary with the given connectivity state. */
function vehicle(state: string, vin = '5YJ3E1EA1JF000000') {
  return { vin, state, id: 1, vehicle_id: 2, display_name: 'Car', id_s: '1' }
}

function clientWith(responses: Response[]) {
  const queue = [...responses]
  const fetchMock = vi.fn<FetchLike>(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch called more times than scripted')
    return next
  })
  return {
    client: new TeslaClient({ accessToken: 't', fetch: fetchMock }),
    fetchMock,
  }
}

describe('vehicle data', () => {
  it('requests only the selected subtrees', async () => {
    const { client, fetchMock } = clientWith([envelope(vehicle('online'))])
    await client.vehicles.data('VIN1', { endpoints: ['charge_state', 'drive_state'] })
    const url = fetchMock.mock.calls[0]?.[0]!
    expect(decodeURIComponent(url)).toContain('endpoints=charge_state;drive_state')
  })

  it('excludes location data by default, since it needs a separate scope', async () => {
    const { client, fetchMock } = clientWith([envelope(vehicle('online'))])
    await client.vehicles.data('VIN1')
    expect(decodeURIComponent(fetchMock.mock.calls[0]?.[0]!)).not.toContain('location_data')
  })
})

describe('pagination', () => {
  it('walks pages until the cursor is exhausted', async () => {
    const { client, fetchMock } = clientWith([
      envelope([vehicle('online', 'A')], {
        next: 2,
        previous: null,
        current: 1,
        per_page: 1,
        count: 2,
        pages: 2,
      }),
      envelope([vehicle('asleep', 'B')], {
        next: null,
        previous: 1,
        current: 2,
        per_page: 1,
        count: 2,
        pages: 2,
      }),
    ])

    const vins: string[] = []
    for await (const v of client.vehicles.listAll({ perPage: 1 })) vins.push(v.vin)

    expect(vins).toEqual(['A', 'B'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops on a short page when no cursor is returned', async () => {
    const { client, fetchMock } = clientWith([envelope([vehicle('online', 'A')])])
    const vins: string[] = []
    for await (const v of client.vehicles.listAll({ perPage: 100 })) vins.push(v.vin)
    expect(vins).toEqual(['A'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('wake handling', () => {
  it('skips the wake request when the vehicle is already online', async () => {
    const { client, fetchMock } = clientWith([envelope(vehicle('online'))])
    await client.vehicles.ensureAwake('VIN1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('wake_up')
  })

  it('wakes and polls until the vehicle reports online', async () => {
    const { client, fetchMock } = clientWith([
      envelope(vehicle('asleep')),
      envelope(vehicle('waking')),
      envelope(vehicle('online')),
    ])
    const result = await client.vehicles.ensureAwake('VIN1', { pollIntervalMs: 1 })
    expect(result.state).toBe('online')
    expect(fetchMock.mock.calls[1]?.[0]).toContain('wake_up')
  })

  it('times out when the vehicle never wakes', async () => {
    // Always asleep, so the deadline rather than the fixture ends the loop.
    const fetchMock = vi.fn<FetchLike>(async () => envelope(vehicle('asleep')))
    const client = new TeslaClient({ accessToken: 't', fetch: fetchMock })

    await expect(
      client.vehicles.ensureAwake('VIN1', { pollIntervalMs: 1, maxWaitMs: 20 }),
    ).rejects.toBeInstanceOf(TimeoutError)
  })

  it('retries the operation once after waking the vehicle', async () => {
    const { client, fetchMock } = clientWith([
      new Response(JSON.stringify({ error: 'asleep' }), {
        status: 408,
        headers: { 'content-type': 'application/json' },
      }),
      envelope(vehicle('online')),
      envelope({ charge_state: { battery_level: 72 } }),
    ])

    const data = await client.vehicles.withWake('VIN1', () => client.vehicles.data('VIN1'), {
      pollIntervalMs: 1,
    })
    expect(data.charge_state?.battery_level).toBe(72)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
