import { describe, expect, it, vi } from 'vitest'
import type { FetchLike } from '../src/index.js'
import { TeslaClient, TeslaError, TimeoutError } from '../src/index.js'

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string>) },
  })
}

function clientWith(fetchMock: FetchLike): TeslaClient {
  return new TeslaClient({
    accessToken: 't',
    fetch: fetchMock,
    retry: { initialDelayMs: 1, maxDelayMs: 2 },
  })
}

describe('response decoding', () => {
  it('returns undefined for a 204', async () => {
    const client = clientWith(vi.fn<FetchLike>(async () => new Response(null, { status: 204 })))
    await expect(client.vehicles.list()).resolves.toBeUndefined()
  })

  it('returns undefined for an empty body', async () => {
    const client = clientWith(
      vi.fn<FetchLike>(
        async () => new Response('', { headers: { 'content-type': 'application/json' } }),
      ),
    )
    await expect(client.vehicles.list()).resolves.toBeUndefined()
  })

  it('raises a parse error on malformed JSON', async () => {
    const client = clientWith(
      vi.fn<FetchLike>(
        async () => new Response('{oops', { headers: { 'content-type': 'application/json' } }),
      ),
    )
    await expect(client.vehicles.list()).rejects.toThrow(/parse JSON/i)
  })

  it('passes through a payload that has no response envelope', async () => {
    const client = clientWith(vi.fn<FetchLike>(async () => json([{ vin: 'BARE' }])))
    await expect(client.vehicles.list()).resolves.toEqual([{ vin: 'BARE' }])
  })

  it('preserves binary bodies for PDF invoices', async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0xff, 0x00, 0xfe])
    const client = clientWith(
      vi.fn<FetchLike>(
        async () => new Response(pdf, { headers: { 'content-type': 'application/pdf' } }),
      ),
    )

    const result = await client.charging.invoice('inv-1')
    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(new Uint8Array(result)).toEqual(pdf)
  })

  it('keeps a non-JSON text body as text', async () => {
    const client = clientWith(
      vi.fn<FetchLike>(
        async () => new Response('plain', { headers: { 'content-type': 'text/plain' } }),
      ),
    )
    await expect(client.vehicles.list()).resolves.toBe('plain')
  })
})

describe('cancellation', () => {
  it('rejects when the caller aborts, without retrying', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn<FetchLike>(async (_url, init) => {
      controller.abort()
      init?.signal?.throwIfAborted()
      return json({ response: [] })
    })

    const client = clientWith(fetchMock)
    await expect(client.vehicles.list({ signal: controller.signal })).rejects.toBeInstanceOf(
      TimeoutError,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces a per-request timeout', async () => {
    const fetchMock = vi.fn<FetchLike>(
      async (_url, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason as Error)
          })
        }),
    )

    const client = clientWith(fetchMock)
    await expect(client.vehicles.get('VIN1', { timeoutMs: 5 })).rejects.toBeInstanceOf(TimeoutError)
  })
})

describe('request construction', () => {
  it('merges custom headers over the defaults', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json({ response: [] }))
    const client = new TeslaClient({
      accessToken: 't',
      fetch: fetchMock,
      headers: { 'x-app': 'demo' },
    })

    await client.vehicles.list()
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['x-app']).toBe('demo')
    expect(headers['accept']).toBe('application/json')
  })

  it('reports each attempt to onRequest', async () => {
    const entries: { attempt: number; status: number | undefined }[] = []
    const responses = [json({ error: 'boom' }, { status: 503 }), json({ response: [] })]
    const fetchMock = vi.fn<FetchLike>(async () => responses.shift() ?? json({ response: [] }))

    const client = new TeslaClient({
      accessToken: 't',
      fetch: fetchMock,
      retry: { initialDelayMs: 1, maxDelayMs: 2 },
      onRequest: ({ attempt, status }) => entries.push({ attempt, status }),
    })

    await client.vehicles.list()
    expect(entries).toEqual([
      { attempt: 1, status: 503 },
      { attempt: 2, status: 200 },
    ])
  })

  it('normalizes a base URL with a trailing slash', () => {
    const client = new TeslaClient({ baseUrl: 'https://proxy.local:4443/', accessToken: 't' })
    expect(client.baseUrl).toBe('https://proxy.local:4443')
  })

  it('keeps Fleet API on Bearer when an OCPI token is also configured', async () => {
    const seen: { host: string; auth: string | undefined }[] = []
    const fetchMock = vi.fn<FetchLike>(async (url, init) => {
      const headers = init?.headers as Record<string, string> | undefined
      seen.push({ host: new URL(url).host, auth: headers?.['authorization'] })
      return json({ response: [], data: [], status_code: 1000 })
    })

    const client = new TeslaClient({
      region: 'na',
      accessToken: 'oauth-tok',
      ocpiToken: 'ocpi-tok',
      ocpiBaseUrl: 'https://ocpi.example.com',
      fetch: fetchMock,
    })

    await client.vehicles.list()
    await client.charging.history()
    await client.ocpi.locations()

    // Fleet API and its charging endpoints keep the OAuth session; only the
    // separate Charging API product uses the OCPI credential and host.
    expect(seen[0]).toEqual({ host: 'fleet-api.prd.na.vn.cloud.tesla.com', auth: 'Bearer oauth-tok' })
    expect(seen[1]).toEqual({ host: 'fleet-api.prd.na.vn.cloud.tesla.com', auth: 'Bearer oauth-tok' })
    expect(seen[2]).toEqual({ host: 'ocpi.example.com', auth: 'Token ocpi-tok' })
  })

  it('falls back to baseUrl for OCPI when ocpiBaseUrl is omitted', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json({ data: [], status_code: 1000 }))
    const client = new TeslaClient({
      baseUrl: 'https://proxy.example.com',
      ocpiToken: 'k',
      fetch: fetchMock,
    })

    await client.ocpi.locations()
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('https://proxy.example.com/ocpi/')
  })

  it('sends the OCPI Token scheme instead of Bearer', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json({ data: [], status_code: 1000 }))
    const client = new TeslaClient({
      baseUrl: 'https://ocpi.example.com',
      ocpiToken: 'ocpi-secret',
      fetch: fetchMock,
    })

    await client.ocpi.locations()
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['authorization']).toBe('Token ocpi-secret')
  })
})

describe('paginated envelope validation', () => {
  it('rejects a response that is not an envelope', async () => {
    const client = clientWith(vi.fn<FetchLike>(async () => json([{ vin: 'A' }])))
    const iterator = client.vehicles.listAll()
    await expect(iterator.next()).rejects.toBeInstanceOf(TeslaError)
  })

  it('rejects an envelope whose payload is not an array', async () => {
    const client = clientWith(vi.fn<FetchLike>(async () => json({ response: { nope: true } })))
    const iterator = client.vehicles.listAll()
    await expect(iterator.next()).rejects.toThrow(/array of vehicles/i)
  })
})
