import { describe, expect, it, vi } from 'vitest'
import type { FetchLike } from '../src/index.js'
import {
  AuthenticationError,
  NotFoundError,
  ServerError,
  SigningRequiredError,
  TeslaClient,
  TeslaError,
  VehicleAsleepError,
} from '../src/index.js'

/** Builds a JSON `Response` with the Fleet API envelope. */
function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string>) },
  })
}

/** Creates a client whose fetch is a queue of scripted responses. */
function clientWith(responses: (Response | Error)[], overrides = {}) {
  const queue = [...responses]
  const fetchMock = vi.fn<FetchLike>(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch called more times than scripted')
    if (next instanceof Error) throw next
    return next
  })
  const client = new TeslaClient({
    accessToken: 'test-token',
    fetch: fetchMock,
    retry: { initialDelayMs: 1, maxDelayMs: 2 },
    ...overrides,
  })
  return { client, fetchMock }
}

describe('request handling', () => {
  it('unwraps the Fleet API response envelope', async () => {
    const { client } = clientWith([jsonResponse({ response: [{ vin: '5YJ3' }] })])
    await expect(client.vehicles.list()).resolves.toEqual([{ vin: '5YJ3' }])
  })

  it('sends the bearer token', async () => {
    const { client, fetchMock } = clientWith([jsonResponse({ response: [] })])
    await client.vehicles.list()
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer test-token')
  })

  it('targets the region base URL', async () => {
    const { client, fetchMock } = clientWith([jsonResponse({ response: [] })], { region: 'eu' })
    await client.vehicles.list()
    expect(fetchMock.mock.calls[0]?.[0]).toContain('fleet-api.prd.eu.vn.cloud.tesla.com')
  })

  it('omits nullish query parameters', async () => {
    const { client, fetchMock } = clientWith([jsonResponse({ response: [] })])
    await client.vehicles.list({ page: 2 })
    const url = fetchMock.mock.calls[0]?.[0]!
    expect(url).toContain('page=2')
    expect(url).not.toContain('per_page')
  })
})

describe('error mapping', () => {
  it.each([
    [401, AuthenticationError],
    [404, NotFoundError],
    [408, VehicleAsleepError],
    [500, ServerError],
  ])('maps HTTP %i to the matching error class', async (status, expected) => {
    const attempts = Array.from({ length: 3 }, () => jsonResponse({ error: 'failed' }, { status }))
    const { client } = clientWith(attempts)
    await expect(client.vehicles.list()).rejects.toBeInstanceOf(expected)
  })

  it('distinguishes a missing virtual key from a missing scope', async () => {
    const { client } = clientWith([
      jsonResponse({ error: 'user not authorized: unsigned command' }, { status: 403 }),
    ])
    await expect(client.commands.honkHorn('5YJ3')).rejects.toBeInstanceOf(SigningRequiredError)
  })

  it('exposes the x-txid request id', async () => {
    const { client } = clientWith([
      jsonResponse({ error: 'nope' }, { status: 404, headers: { 'x-txid': 'txn-42' } }),
    ])
    await expect(client.vehicles.list()).rejects.toMatchObject({ requestId: 'txn-42' })
  })

  it('preserves the error message from the body', async () => {
    const { client } = clientWith([
      jsonResponse({ error_description: 'token expired' }, { status: 401 }),
    ])
    await expect(client.vehicles.list()).rejects.toThrow('token expired')
  })
})

describe('retries', () => {
  it('retries a 500 and returns the eventual success', async () => {
    const { client, fetchMock } = clientWith([
      jsonResponse({ error: 'boom' }, { status: 500 }),
      jsonResponse({ response: [{ vin: 'OK' }] }),
    ])
    await expect(client.vehicles.list()).resolves.toEqual([{ vin: 'OK' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 404', async () => {
    const { client, fetchMock } = clientWith([jsonResponse({ error: 'gone' }, { status: 404 })])
    await expect(client.vehicles.list()).rejects.toBeInstanceOf(NotFoundError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 408, since waking requires an explicit request', async () => {
    const { client, fetchMock } = clientWith([jsonResponse({ error: 'asleep' }, { status: 408 })])
    await expect(client.vehicles.list()).rejects.toBeInstanceOf(VehicleAsleepError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never retries a non-idempotent command', async () => {
    const { client, fetchMock } = clientWith([jsonResponse({ error: 'boom' }, { status: 500 })])
    await expect(client.commands.honkHorn('5YJ3')).rejects.toBeInstanceOf(ServerError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries an idempotent command', async () => {
    const { client, fetchMock } = clientWith([
      jsonResponse({ error: 'boom' }, { status: 500 }),
      jsonResponse({ response: { result: true } }),
    ])
    await expect(client.commands.doorLock('5YJ3')).resolves.toEqual({ result: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces Retry-After on a rate limit', async () => {
    const responses = Array.from({ length: 3 }, () =>
      jsonResponse({ error: 'slow down' }, { status: 429, headers: { 'retry-after': '0' } }),
    )
    const { client } = clientWith(responses)
    await expect(client.vehicles.list()).rejects.toMatchObject({
      code: 'rate_limit',
      retryAfter: 0,
    })
  })

  it('stops after maxRetries', async () => {
    const responses = Array.from({ length: 3 }, () =>
      jsonResponse({ error: 'boom' }, { status: 503 }),
    )
    const { client, fetchMock } = clientWith(responses)
    await expect(client.vehicles.list()).rejects.toBeInstanceOf(ServerError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('wraps a transport failure as a connection error', async () => {
    const { client } = clientWith([
      new TypeError('fetch failed'),
      new TypeError('fetch failed'),
      new TypeError('fetch failed'),
    ])
    await expect(client.vehicles.list()).rejects.toMatchObject({ code: 'connection_error' })
  })
})

describe('commands', () => {
  it('resolves rather than throwing when the vehicle rejects a command', async () => {
    const { client } = clientWith([
      jsonResponse({ response: { result: false, reason: 'not_charging' } }),
    ])
    await expect(client.commands.chargeStop('5YJ3')).resolves.toMatchObject({ result: false })
  })

  it('throws on rejection when throwOnFailure is set', async () => {
    const { client } = clientWith([
      jsonResponse({ response: { result: false, reason: 'not_charging' } }),
    ])
    await expect(
      client.commands.chargeStop('5YJ3', { throwOnFailure: true }),
    ).rejects.toBeInstanceOf(TeslaError)
  })

  it('serializes the command body', async () => {
    const { client, fetchMock } = clientWith([jsonResponse({ response: { result: true } })])
    await client.commands.setChargeLimit('5YJ3', 80)
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ percent: 80 }))
  })

  it('rejects a VIN containing a path separator', async () => {
    const { client } = clientWith([])
    await expect(client.commands.doorLock('../../admin')).rejects.toBeInstanceOf(TypeError)
  })
})
