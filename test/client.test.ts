import { describe, expect, it, vi } from 'vitest'
import type { FetchLike, TokenSet } from '../src/index.js'
import {
  MemoryTokenStore,
  OAuthClient,
  TeslaClient,
  TeslaError,
  createTokenStore,
} from '../src/index.js'

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('token storage', () => {
  it('round-trips and clears an in-memory token set', () => {
    const tokens: TokenSet = { accessToken: 'a', expiresAt: Date.now() + 1000 }
    const store = new MemoryTokenStore()

    expect(store.get()).toBeUndefined()
    store.set(tokens)
    expect(store.get()).toEqual(tokens)
    store.clear()
    expect(store.get()).toBeUndefined()
  })

  it('seeds from an initial token set', () => {
    const tokens: TokenSet = { accessToken: 'seed', expiresAt: 0 }
    expect(new MemoryTokenStore(tokens).get()).toEqual(tokens)
  })

  it('supports an async custom store', async () => {
    let saved: TokenSet | undefined
    const store = createTokenStore({
      get: () => Promise.resolve(saved),
      set: (tokens) => {
        saved = tokens
        return Promise.resolve()
      },
    })

    await store.set({ accessToken: 'x', expiresAt: 1 })
    await expect(store.get()).resolves.toEqual({ accessToken: 'x', expiresAt: 1 })
  })
})

describe('client construction', () => {
  it('exposes every resource namespace', () => {
    const client = new TeslaClient({ accessToken: 't' })
    for (const key of [
      'vehicles',
      'commands',
      'energy',
      'user',
      'charging',
      'partner',
      'fleet',
      'telemetry',
      'ocpi',
      'oauth',
    ] as const) {
      expect(client[key], key).toBeDefined()
    }
  })

  it('throws when no fetch implementation is available', () => {
    const original = globalThis.fetch
    // @ts-expect-error deleting a global for the duration of this assertion
    delete globalThis.fetch
    try {
      expect(() => new TeslaClient()).toThrow(/fetch/i)
    } finally {
      globalThis.fetch = original
    }
  })

  it('sends no authorization header without credentials', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json({ response: [] }))
    await new TeslaClient({ fetch: fetchMock }).vehicles.list()

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    expect(headers['authorization']).toBeUndefined()
  })

  it('reads and replaces stored tokens', async () => {
    const client = new TeslaClient({ accessToken: 'first' })
    await expect(client.getTokens()).resolves.toMatchObject({ accessToken: 'first' })

    await client.setTokens({ accessToken: 'second', expiresAt: Date.now() + 60_000 })
    await expect(client.getTokens()).resolves.toMatchObject({ accessToken: 'second' })
  })
})

describe('forUserRegion', () => {
  it('returns a client bound to the reported base URL', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      json({
        response: {
          region: 'eu',
          fleet_api_base_url: 'https://fleet-api.prd.eu.vn.cloud.tesla.com',
        },
      }),
    )

    const client = new TeslaClient({ region: 'na', accessToken: 't', fetch: fetchMock })
    const regional = await client.forUserRegion()

    expect(regional.baseUrl).toBe('https://fleet-api.prd.eu.vn.cloud.tesla.com')
    expect(regional).not.toBe(client)
  })

  it('returns the same instance when already on the right region', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      json({
        response: {
          region: 'na',
          fleet_api_base_url: 'https://fleet-api.prd.na.vn.cloud.tesla.com',
        },
      }),
    )

    const client = new TeslaClient({ region: 'na', accessToken: 't', fetch: fetchMock })
    await expect(client.forUserRegion()).resolves.toBe(client)
  })

  it('carries the token store to the regional client', async () => {
    const fetchMock = vi.fn<FetchLike>(async (url) =>
      url.includes('/users/region')
        ? json({
            response: {
              region: 'eu',
              fleet_api_base_url: 'https://fleet-api.prd.eu.vn.cloud.tesla.com',
            },
          })
        : json({ response: [] }),
    )

    const client = new TeslaClient({ accessToken: 'shared', fetch: fetchMock })
    const regional = await client.forUserRegion({ fetch: fetchMock })
    await regional.vehicles.list()

    const last = fetchMock.mock.calls.at(-1)
    const headers = last?.[1]?.headers as Record<string, string>
    expect(headers['authorization']).toBe('Bearer shared')
  })
})

describe('oauth edge cases', () => {
  it('requires a client secret for the client_credentials grant', async () => {
    const oauth = new OAuthClient({ clientId: 'abc' }, { fetch: vi.fn<FetchLike>() })
    await expect(oauth.clientCredentials(['openid'])).rejects.toThrow(/clientSecret/)
  })

  it('sends the auth_code for a business token', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json({ access_token: 'b', expires_in: 300 }))
    const oauth = new OAuthClient({ clientId: 'abc', clientSecret: 's' }, { fetch: fetchMock })

    await oauth.businessToken('the-code', ['vehicle_device_data'])

    const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.get('grant_type')).toBe('client_credentials')
    expect(body.get('auth_code')).toBe('the-code')
    expect(body.get('scope')).toBe('vehicle_device_data')
  })

  it('omits auth_code for a partner token', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json({ access_token: 'p', expires_in: 300 }))
    const oauth = new OAuthClient({ clientId: 'abc', clientSecret: 's' }, { fetch: fetchMock })

    await oauth.clientCredentials(['vehicle_specs'])
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.has('auth_code')).toBe(false)
  })

  it('rejects a refresh with no stored token', async () => {
    const oauth = new OAuthClient({ clientId: 'abc' }, { fetch: vi.fn<FetchLike>() })
    await expect(oauth.refresh()).rejects.toThrow(/refresh token/i)
  })

  it('resolves to undefined when nothing is stored', async () => {
    const oauth = new OAuthClient(
      { clientId: 'abc' },
      { fetch: vi.fn<FetchLike>(), store: new MemoryTokenStore() },
    )
    await expect(oauth.getAccessToken()).resolves.toBeUndefined()
  })

  it('keeps using a token that cannot be refreshed', async () => {
    const store = new MemoryTokenStore({ accessToken: 'stale', expiresAt: Date.now() - 1 })
    const fetchMock = vi.fn<FetchLike>()
    const oauth = new OAuthClient({ clientId: 'abc' }, { fetch: fetchMock, store })

    await expect(oauth.getAccessToken()).resolves.toBe('stale')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows a new refresh after an earlier one fails', async () => {
    const store = new MemoryTokenStore({
      accessToken: 'old',
      refreshToken: 'rt',
      expiresAt: Date.now() - 1,
    })
    let attempt = 0
    const fetchMock = vi.fn<FetchLike>(async () => {
      attempt += 1
      return attempt === 1
        ? json({ error: 'server_error' }, { status: 500 })
        : json({ access_token: 'recovered', expires_in: 300 })
    })

    const oauth = new OAuthClient({ clientId: 'abc' }, { fetch: fetchMock, store })

    await expect(oauth.refresh()).rejects.toThrow()
    await expect(oauth.refresh()).resolves.toMatchObject({ accessToken: 'recovered' })
  })

  it('surfaces a non-JSON token error body', async () => {
    const fetchMock = vi.fn<FetchLike>(
      async () => new Response('<html>gateway</html>', { status: 502 }),
    )
    const oauth = new OAuthClient({ clientId: 'abc', clientSecret: 's' }, { fetch: fetchMock })

    await expect(oauth.clientCredentials(['openid'])).rejects.toBeInstanceOf(TeslaError)
  })

  it('falls back to a status message when the error body is empty', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response('', { status: 500 }))
    const oauth = new OAuthClient({ clientId: 'abc', clientSecret: 's' }, { fetch: fetchMock })

    await expect(oauth.clientCredentials(['openid'])).rejects.toThrow(/HTTP 500/)
  })

  it('prefers error over error_description when only error is present', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      json({ error: 'invalid_client' }, { status: 401 }),
    )
    const oauth = new OAuthClient({ clientId: 'abc', clientSecret: 's' }, { fetch: fetchMock })

    await expect(oauth.clientCredentials(['openid'])).rejects.toThrow('invalid_client')
  })
})

describe('token payload mapping', () => {
  /** Exchanges a code against a scripted token response. */
  async function exchange(payload: Record<string, unknown>): Promise<TokenSet> {
    const oauth = new OAuthClient(
      { clientId: 'abc', clientSecret: 's', redirectUri: 'https://app/cb' },
      { fetch: vi.fn<FetchLike>(async () => json(payload)) },
    )
    return await oauth.exchangeCode({ code: 'c' })
  }

  it('omits absent optional fields', async () => {
    const tokens = await exchange({ access_token: 'a', expires_in: 300 })
    expect(tokens.refreshToken).toBeUndefined()
    expect(tokens.idToken).toBeUndefined()
    expect(tokens.scopes).toBeUndefined()
    expect(tokens.tokenType).toBe('Bearer')
  })

  it('maps every optional field when present', async () => {
    const tokens = await exchange({
      access_token: 'a',
      refresh_token: 'r',
      id_token: 'i',
      expires_in: 300,
      scope: 'openid vehicle_cmds',
      token_type: 'MAC',
    })

    expect(tokens.refreshToken).toBe('r')
    expect(tokens.idToken).toBe('i')
    expect(tokens.scopes).toEqual(['openid', 'vehicle_cmds'])
    expect(tokens.tokenType).toBe('MAC')
  })

  it('drops empty entries from a padded scope string', async () => {
    const tokens = await exchange({ access_token: 'a', expires_in: 300, scope: ' openid  ' })
    expect(tokens.scopes).toEqual(['openid'])
  })

  it('converts expires_in to an absolute timestamp', async () => {
    const before = Date.now()
    const tokens = await exchange({ access_token: 'a', expires_in: 3600 })
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000)
  })
})

describe('authorize URL options', () => {
  const oauth = new OAuthClient(
    { clientId: 'abc', redirectUri: 'https://app/cb' },
    { fetch: vi.fn<FetchLike>() },
  )

  it('omits pkce, prompt, and nonce when not requested', () => {
    const url = new URL(oauth.authorizeUrl({ scopes: ['user_data'], state: 's' }))
    expect(url.searchParams.has('code_challenge')).toBe(false)
    expect(url.searchParams.has('prompt')).toBe(false)
    expect(url.searchParams.has('nonce')).toBe(false)
  })

  it('includes prompt and nonce when supplied', () => {
    const url = new URL(
      oauth.authorizeUrl({ scopes: [], state: 's', prompt: 'consent', nonce: 'n1' }),
    )
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('nonce')).toBe('n1')
  })

  it('accepts a per-call redirect URI override', () => {
    const url = new URL(
      oauth.authorizeUrl({ scopes: [], state: 's', redirectUri: 'https://other/cb' }),
    )
    expect(url.searchParams.get('redirect_uri')).toBe('https://other/cb')
  })
})

describe('code exchange options', () => {
  it('requires a redirect URI', async () => {
    const oauth = new OAuthClient({ clientId: 'abc' }, { fetch: vi.fn<FetchLike>() })
    await expect(oauth.exchangeCode({ code: 'c' })).rejects.toThrow(/redirectUri/)
  })

  it('omits the client secret for a public client', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json({ access_token: 'a', expires_in: 300 }))
    const oauth = new OAuthClient(
      { clientId: 'abc', redirectUri: 'https://app/cb' },
      { fetch: fetchMock },
    )

    await oauth.exchangeCode({ code: 'c', codeVerifier: 'v' })
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.has('client_secret')).toBe(false)
    expect(body.get('code_verifier')).toBe('v')
  })

  it('omits the verifier when PKCE is not used', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json({ access_token: 'a', expires_in: 300 }))
    const oauth = new OAuthClient(
      { clientId: 'abc', clientSecret: 's', redirectUri: 'https://app/cb' },
      { fetch: fetchMock },
    )

    await oauth.exchangeCode({ code: 'c' })
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.has('code_verifier')).toBe(false)
    expect(body.get('client_secret')).toBe('s')
  })

  it('accepts a per-call redirect URI override', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => json({ access_token: 'a', expires_in: 300 }))
    const oauth = new OAuthClient({ clientId: 'abc' }, { fetch: fetchMock })

    await oauth.exchangeCode({ code: 'c', redirectUri: 'https://only/cb' })
    const body = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.get('redirect_uri')).toBe('https://only/cb')
  })
})
