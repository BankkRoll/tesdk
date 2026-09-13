/**
 * Direct coverage for the internal transport primitives and the error
 * hierarchy, including paths the resource-level tests cannot reach.
 */

import { describe, expect, it, vi } from 'vitest'
import type { FetchLike } from '../src/index.js'
import {
  AuthenticationError,
  ConnectionError,
  InvalidRequestError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServerError,
  SigningRequiredError,
  TeslaClient,
  TeslaError,
  TimeoutError,
  VehicleAsleepError,
} from '../src/index.js'
import { errorFromStatus } from '../src/core/errors.js'
import { sleep } from '../src/core/sleep.js'

describe('sleep', () => {
  it('resolves after the delay', async () => {
    const startedAt = Date.now()
    await sleep(10)
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(5)
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort(new Error('already gone'))
    await expect(sleep(1000, controller.signal)).rejects.toThrow('already gone')
  })

  it('rejects when aborted mid-flight', async () => {
    const controller = new AbortController()
    const pending = sleep(1000, controller.signal)
    controller.abort(new Error('cancelled'))
    await expect(pending).rejects.toThrow('cancelled')
  })

  it('resolves normally when a signal is supplied but never aborts', async () => {
    const controller = new AbortController()
    await expect(sleep(5, controller.signal)).resolves.toBeUndefined()
  })
})

describe('errorFromStatus', () => {
  it.each([
    [400, InvalidRequestError],
    [422, InvalidRequestError],
    [401, AuthenticationError],
    [403, PermissionError],
    [404, NotFoundError],
    [408, VehicleAsleepError],
    [429, RateLimitError],
    [500, ServerError],
    [503, ServerError],
  ])('maps %i', (status, expected) => {
    expect(errorFromStatus(status, 'failed')).toBeInstanceOf(expected)
  })

  it('maps an unrecognized 4xx to the base error', () => {
    const error = errorFromStatus(418, 'teapot')
    expect(error).toBeInstanceOf(TeslaError)
    expect(error.code).toBe('api_error')
  })

  it.each(['unsigned command', 'requires a signed command', 'missing virtual key'])(
    'treats a 403 mentioning %s as a signing failure',
    (message) => {
      expect(errorFromStatus(403, message)).toBeInstanceOf(SigningRequiredError)
    },
  )

  it('treats a plain 403 as a permission failure', () => {
    const error = errorFromStatus(403, 'insufficient scope')
    expect(error).toBeInstanceOf(PermissionError)
    expect(error).not.toBeInstanceOf(SigningRequiredError)
  })
})

describe('error construction', () => {
  it('exposes stable codes across the hierarchy', () => {
    expect(new AuthenticationError('x').code).toBe('authentication_error')
    expect(new PermissionError('x').code).toBe('permission_error')
    expect(new NotFoundError('x').code).toBe('not_found')
    expect(new InvalidRequestError('x').code).toBe('invalid_request')
    expect(new RateLimitError('x').code).toBe('rate_limit')
    expect(new VehicleAsleepError('x').code).toBe('vehicle_asleep')
    expect(new ServerError('x').code).toBe('server_error')
    expect(new ConnectionError('x').code).toBe('connection_error')
    expect(new TimeoutError('x').code).toBe('timeout')
    expect(new SigningRequiredError('x').code).toBe('signing_required')
    expect(new TeslaError('x').code).toBe('api_error')
  })

  it('names each error after its class', () => {
    expect(new NotFoundError('x').name).toBe('NotFoundError')
    expect(new RateLimitError('x').name).toBe('RateLimitError')
  })

  it('leaves optional metadata undefined by default', () => {
    const error = new TeslaError('bare')
    expect(error.status).toBeUndefined()
    expect(error.requestId).toBeUndefined()
    expect(error.body).toBeUndefined()
    expect(error.cause).toBeUndefined()
  })

  it('retains a cause when supplied', () => {
    const cause = new Error('root')
    expect(new TeslaError('wrapped', { cause }).cause).toBe(cause)
  })

  it('leaves retryAfter undefined when not supplied', () => {
    expect(new RateLimitError('x').retryAfter).toBeUndefined()
  })
})

/** Builds a client whose fetch returns one scripted response. */
function clientReturning(response: () => Response | Promise<Response>): TeslaClient {
  return new TeslaClient({
    accessToken: 't',
    fetch: vi.fn<FetchLike>(async () => await response()),
    retry: { maxRetries: 0 },
  })
}

describe('error body extraction', () => {
  it('prefers error_description over error', async () => {
    const client = clientReturning(
      () =>
        new Response(JSON.stringify({ error: 'short', error_description: 'detailed' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    )
    await expect(client.vehicles.list()).rejects.toThrow('detailed')
  })

  it('falls back to message', async () => {
    const client = clientReturning(
      () =>
        new Response(JSON.stringify({ message: 'from message' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    )
    await expect(client.vehicles.list()).rejects.toThrow('from message')
  })

  it('falls back to the status when the body carries no message', async () => {
    const client = clientReturning(
      () =>
        new Response(JSON.stringify({ unrelated: true }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
    )
    await expect(client.vehicles.list()).rejects.toThrow('HTTP 404')
  })

  it('uses a plain-text error body verbatim', async () => {
    const client = clientReturning(() => new Response('upstream exploded', { status: 502 }))
    await expect(client.vehicles.list()).rejects.toThrow('upstream exploded')
  })

  it('keeps an HTML gateway body as the error body', async () => {
    const client = clientReturning(
      () =>
        new Response('<html>502</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        }),
    )
    await expect(client.vehicles.list()).rejects.toMatchObject({ body: '<html>502</html>' })
  })

  it('handles an empty error body', async () => {
    const client = clientReturning(() => new Response('', { status: 500 }))
    await expect(client.vehicles.list()).rejects.toThrow('HTTP 500')
  })
})

describe('Retry-After parsing', () => {
  it('reads a delay given in seconds', async () => {
    const client = clientReturning(
      () => new Response('{}', { status: 429, headers: { 'retry-after': '7' } }),
    )
    await expect(client.vehicles.list()).rejects.toMatchObject({ retryAfter: 7 })
  })

  it('reads a delay given as an HTTP date', async () => {
    const future = new Date(Date.now() + 20_000).toUTCString()
    const client = clientReturning(
      () => new Response('{}', { status: 429, headers: { 'retry-after': future } }),
    )
    const error = (await client.vehicles.list().catch((e: unknown) => e)) as RateLimitError
    expect(error.retryAfter).toBeGreaterThan(0)
  })

  it('ignores an unparseable value', async () => {
    const client = clientReturning(
      () => new Response('{}', { status: 429, headers: { 'retry-after': 'soon' } }),
    )
    await expect(client.vehicles.list()).rejects.toMatchObject({ retryAfter: undefined })
  })

  it('clamps a past date to zero', async () => {
    const past = new Date(Date.now() - 60_000).toUTCString()
    const client = clientReturning(
      () => new Response('{}', { status: 429, headers: { 'retry-after': past } }),
    )
    await expect(client.vehicles.list()).rejects.toMatchObject({ retryAfter: 0 })
  })
})

describe('retry backoff', () => {
  it('waits out a Retry-After hint before retrying', async () => {
    const responses = [
      new Response('{}', { status: 429, headers: { 'retry-after': '0' } }),
      new Response(JSON.stringify({ response: [] }), {
        headers: { 'content-type': 'application/json' },
      }),
    ]
    const fetchMock = vi.fn<FetchLike>(async () => responses.shift()!)

    const client = new TeslaClient({
      accessToken: 't',
      fetch: fetchMock,
      retry: { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 1 },
    })

    await expect(client.vehicles.list()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('caps backoff at maxDelayMs', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response('{}', { status: 503 }))
    const client = new TeslaClient({
      accessToken: 't',
      fetch: fetchMock,
      retry: { maxRetries: 3, initialDelayMs: 1000, maxDelayMs: 2 },
    })

    const startedAt = Date.now()
    await expect(client.vehicles.list()).rejects.toBeInstanceOf(ServerError)
    expect(Date.now() - startedAt).toBeLessThan(1000)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('retries a 425 and a 502', async () => {
    for (const status of [425, 502]) {
      const responses = [
        new Response('{}', { status }),
        new Response(JSON.stringify({ response: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
      ]
      const fetchMock = vi.fn<FetchLike>(async () => responses.shift()!)
      const client = new TeslaClient({
        accessToken: 't',
        fetch: fetchMock,
        retry: { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 1 },
      })

      await client.vehicles.list()
      expect(fetchMock, `status ${status}`).toHaveBeenCalledTimes(2)
    }
  })

  it('retries a transport failure before succeeding', async () => {
    let calls = 0
    const fetchMock = vi.fn<FetchLike>(async () => {
      calls += 1
      if (calls === 1) throw new TypeError('socket hang up')
      return new Response(JSON.stringify({ response: [] }), {
        headers: { 'content-type': 'application/json' },
      })
    })

    const client = new TeslaClient({
      accessToken: 't',
      fetch: fetchMock,
      retry: { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 1 },
    })

    await expect(client.vehicles.list()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports a transport failure to onRequest', async () => {
    const seen: unknown[] = []
    const client = new TeslaClient({
      accessToken: 't',
      fetch: vi.fn<FetchLike>(() => Promise.reject(new TypeError('dns failure'))),
      retry: { maxRetries: 0 },
      onRequest: ({ error }) => seen.push(error),
    })

    await expect(client.vehicles.list()).rejects.toBeInstanceOf(ConnectionError)
    expect(seen).toHaveLength(1)
  })

  it('wraps a non-Error rejection', async () => {
    const client = new TeslaClient({
      accessToken: 't',
      // Rejecting with a non-Error is the exact case under test: a runtime or
      // polyfill whose fetch throws a bare value must still yield a TeslaError.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      fetch: vi.fn<FetchLike>(() => Promise.reject('plain string')),
      retry: { maxRetries: 0 },
    })
    await expect(client.vehicles.list()).rejects.toThrow(/plain string/)
  })

  it('reports a bare AbortError as a timeout', async () => {
    const client = new TeslaClient({
      accessToken: 't',
      fetch: vi.fn<FetchLike>(() => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        return Promise.reject(error)
      }),
      retry: { maxRetries: 0 },
    })

    await expect(client.vehicles.list()).rejects.toMatchObject({
      code: 'timeout',
      message: 'Request timed out',
    })
  })
})

describe('URL construction', () => {
  /** Captures the URL produced for a request. */
  async function urlFor(
    run: (client: TeslaClient) => Promise<unknown>,
    baseUrl?: string,
  ): Promise<string> {
    const fetchMock = vi.fn<FetchLike>(
      async () =>
        new Response(JSON.stringify({ response: {} }), {
          headers: { 'content-type': 'application/json' },
        }),
    )
    await run(new TeslaClient({ accessToken: 't', fetch: fetchMock, ...(baseUrl ? { baseUrl } : {}) }))
    return String(fetchMock.mock.calls[0]?.[0])
  }

  it('preserves a base URL path prefix', async () => {
    const url = await urlFor((c) => c.vehicles.list(), 'https://proxy.local/tesla')
    expect(url).toBe('https://proxy.local/tesla/api/1/vehicles')
  })

  it('serializes boolean and numeric query values', async () => {
    const url = await urlFor((c) => c.charging.history({ page: 2, perPage: 50 }))
    expect(url).toContain('pageNo=2')
    expect(url).toContain('pageSize=50')
  })
})

describe('vehicle wake fallbacks', () => {
  it('rethrows a non-asleep error from withWake without waking', async () => {
    const fetchMock = vi.fn<FetchLike>(
      async () =>
        new Response(JSON.stringify({ error: 'nope' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
    )
    const client = new TeslaClient({ accessToken: 't', fetch: fetchMock, retry: { maxRetries: 0 } })

    await expect(
      client.vehicles.withWake('VIN1', () => client.vehicles.data('VIN1')),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops paging on an empty first page', async () => {
    const fetchMock = vi.fn<FetchLike>(
      async () =>
        new Response(JSON.stringify({ response: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
    )
    const client = new TeslaClient({ accessToken: 't', fetch: fetchMock })

    const seen = []
    for await (const vehicle of client.vehicles.listAll({ perPage: 10 })) seen.push(vehicle)

    expect(seen).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops paging when the cursor reports no next page', async () => {
    const fetchMock = vi.fn<FetchLike>(
      async () =>
        new Response(
          JSON.stringify({
            response: [{ vin: 'A' }, { vin: 'B' }],
            pagination: { next: null, previous: null, current: 1, per_page: 2, count: 2, pages: 1 },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    )
    const client = new TeslaClient({ accessToken: 't', fetch: fetchMock })

    const vins = []
    for await (const vehicle of client.vehicles.listAll({ perPage: 2 })) vins.push(vehicle.vin)

    expect(vins).toEqual(['A', 'B'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
