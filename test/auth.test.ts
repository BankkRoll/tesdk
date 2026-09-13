import { describe, expect, it, vi } from 'vitest'
import type { FetchLike } from '../src/index.js'
import {
  AuthenticationError,
  MemoryTokenStore,
  OAuthClient,
  TeslaClient,
  createPkcePair,
  randomString,
  regionForCountry,
  resolveBaseUrl,
} from '../src/index.js'

/** Builds a token endpoint response. */
function tokenResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('regions', () => {
  it('maps countries to their serving region', () => {
    expect(regionForCountry('us')).toBe('na')
    expect(regionForCountry('DE')).toBe('eu')
    expect(regionForCountry('JP')).toBe('na')
    expect(regionForCountry('CN')).toBe('cn')
    expect(regionForCountry('ZZ')).toBeUndefined()
  })

  it('accepts a custom base URL and strips trailing slashes', () => {
    expect(resolveBaseUrl('eu')).toBe('https://fleet-api.prd.eu.vn.cloud.tesla.com')
    expect(resolveBaseUrl('https://proxy.local:4443/')).toBe('https://proxy.local:4443')
  })
})

describe('PKCE', () => {
  it('derives a verifier and S256 challenge that differ', async () => {
    const pkce = await createPkcePair()
    expect(pkce.method).toBe('S256')
    expect(pkce.verifier).not.toBe(pkce.challenge)
    expect(pkce.challenge).not.toMatch(/[+/=]/)
  })

  it('produces distinct random strings', () => {
    expect(randomString()).not.toBe(randomString())
  })
})

describe('authorization URL', () => {
  const oauth = new OAuthClient(
    { clientId: 'abc', redirectUri: 'https://app.example/cb', region: 'eu' },
    { fetch: vi.fn<FetchLike>() },
  )

  it('includes the required parameters', async () => {
    const pkce = await createPkcePair()
    const url = new URL(oauth.authorizeUrl({ scopes: ['vehicle_device_data'], state: 'xyz', pkce }))
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('client_id')).toBe('abc')
    expect(url.searchParams.get('state')).toBe('xyz')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('always requests openid and offline_access', () => {
    const url = new URL(oauth.authorizeUrl({ scopes: ['vehicle_cmds'], state: 's' }))
    const scopes = url.searchParams.get('scope')?.split(' ') ?? []
    expect(scopes).toContain('openid')
    expect(scopes).toContain('offline_access')
    expect(scopes).toContain('vehicle_cmds')
  })

  it('throws when no redirect URI is configured', () => {
    const bare = new OAuthClient({ clientId: 'abc' }, { fetch: vi.fn<FetchLike>() })
    expect(() => bare.authorizeUrl({ scopes: [], state: 's' })).toThrow(/redirectUri/)
  })
})

describe('token exchange', () => {
  it('stores tokens with an absolute expiry', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      tokenResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
    )
    const store = new MemoryTokenStore()
    const oauth = new OAuthClient(
      { clientId: 'abc', clientSecret: 's', redirectUri: 'https://app/cb' },
      { fetch: fetchMock, store },
    )

    const tokens = await oauth.exchangeCode({ code: 'the-code', codeVerifier: 'v' })
    expect(tokens.accessToken).toBe('at')
    expect(tokens.expiresAt).toBeGreaterThan(Date.now())
    expect(store.get()?.refreshToken).toBe('rt')

    const body = new URLSearchParams(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code_verifier')).toBe('v')
    expect(body.get('audience')).toContain('fleet-api')
  })

  it('raises an authentication error on a rejected grant', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      tokenResponse({ error: 'invalid_grant', error_description: 'code used' }, 400),
    )
    const oauth = new OAuthClient(
      { clientId: 'abc', clientSecret: 's', redirectUri: 'https://app/cb' },
      { fetch: fetchMock },
    )
    await expect(oauth.exchangeCode({ code: 'used' })).rejects.toBeInstanceOf(AuthenticationError)
  })
})

describe('token refresh', () => {
  it('refreshes an expired token before the request', async () => {
    const fetchMock = vi.fn<FetchLike>(async (url: string) => {
      if (url.includes('/oauth2/v3/token')) {
        return tokenResponse({ access_token: 'fresh', expires_in: 3600 })
      }
      return new Response(JSON.stringify({ response: [] }), {
        headers: { 'content-type': 'application/json' },
      })
    })

    const client = new TeslaClient({
      clientId: 'abc',
      clientSecret: 's',
      tokens: { accessToken: 'stale', refreshToken: 'rt', expiresAt: Date.now() - 1000 },
      fetch: fetchMock,
    })

    await client.vehicles.list()
    const apiCall = fetchMock.mock.calls.find(([url]) => url.includes('fleet-api'))
    const headers = apiCall?.[1]?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer fresh')
  })

  it('carries the refresh token forward when the response omits it', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      tokenResponse({ access_token: 'new', expires_in: 3600 }),
    )
    const store = new MemoryTokenStore({
      accessToken: 'old',
      refreshToken: 'keep-me',
      expiresAt: Date.now() - 1,
    })
    const oauth = new OAuthClient({ clientId: 'abc' }, { fetch: fetchMock, store })

    await oauth.refresh()
    expect(store.get()?.refreshToken).toBe('keep-me')
  })

  it('collapses concurrent refreshes into one request', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      tokenResponse({ access_token: 'one', expires_in: 3600 }),
    )
    const store = new MemoryTokenStore({
      accessToken: 'old',
      refreshToken: 'rt',
      expiresAt: Date.now() - 1,
    })
    const oauth = new OAuthClient({ clientId: 'abc' }, { fetch: fetchMock, store })

    await Promise.all([oauth.refresh(), oauth.refresh(), oauth.refresh()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not refresh a token that is still valid', async () => {
    const fetchMock = vi.fn<FetchLike>()
    const store = new MemoryTokenStore({
      accessToken: 'valid',
      refreshToken: 'rt',
      expiresAt: Date.now() + 600_000,
    })
    const oauth = new OAuthClient({ clientId: 'abc' }, { fetch: fetchMock, store })

    await expect(oauth.getAccessToken()).resolves.toBe('valid')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
