# Authentication

> Three token types, each for a different relationship between your application
> and the vehicles it reaches.

| Token | Represents | Grant |
| --- | --- | --- |
| Third-party | A person who granted your app access | `authorization_code` + PKCE |
| Partner | Your application itself | `client_credentials` |
| Third-party business | A business fleet | `client_credentials` + `auth_code` |

## Authorization code with PKCE

```ts
const pkce = await createPkcePair()
const state = randomString()

// Persist both against the user's session before redirecting.
const url = client.oauth.authorizeUrl({ scopes: ['vehicle_device_data'], state, pkce })

// In your callback, after checking that state matches:
const tokens = await client.oauth.exchangeCode({ code, codeVerifier: pkce.verifier })
```

## Partner tokens

Partner tokens represent the application rather than a user. Required for every
`client.partner` endpoint and for the partner-only `vehicle_specs` and
`vehicle_pricing_info` scopes. They carry no user context, so `client.user`
rejects them.

```ts
await client.oauth.clientCredentials(['openid', 'vehicle_specs'])
await client.partner.register('example.com')
```

## Business tokens

No browser redirect: a business administrator grants consent once in Tesla for
Business and hands over an authorization code.

```ts
await client.oauth.businessToken(authCode, ['vehicle_device_data', 'vehicle_cmds'])
```

## Refresh

Give the client a token set and it refreshes on demand, one minute before expiry.
Concurrent requests share a single in-flight refresh rather than stampeding the
token endpoint.

```ts
const client = new TeslaClient({
  clientId,
  clientSecret,
  tokens: { accessToken, refreshToken, expiresAt },
})
```

## Token stores

```ts
import { createTokenStore } from '@bankkroll/tesdk'

const tokenStore = createTokenStore({
  get: () => db.tokens.find(userId),
  set: (tokens) => db.tokens.upsert(userId, tokens),
})
```

A refresh token grants the same access as a password until revoked. Encrypt it at
rest, and never log it.

## Scopes

| Scope | Grants |
| --- | --- |
| `openid` | Sign in with Tesla |
| `offline_access` | A refresh token |
| `user_data` | Contact information, address, profile |
| `vehicle_device_data` | Live vehicle data, service history, upgrades |
| `vehicle_location` | Precise and coarse location |
| `vehicle_cmds` | Driver management, unlock, wake, remote start |
| `vehicle_charging_cmds` | Charging history and start, stop, schedule |
| `energy_device_data` | Energy live status, site info, history |
| `energy_cmds` | Backup reserve, operation mode, storm mode |
| `vehicle_specs` | Detailed specifications. Partner tokens only |
| `vehicle_pricing_info` | Pricing by market and model. Partner tokens only |
| `enterprise_management` | Enterprise functions for business accounts |

## Virtual keys

Commanding a 2021+ vehicle requires a virtual key paired to the car. Host your
public key, register the domain, then send the user to the pairing link.

```ts
import { virtualKeyPairingUrl, publicKeyUrl } from '@bankkroll/tesdk'

publicKeyUrl('example.com')
// https://example.com/.well-known/appspecific/com.tesla.3p.public-key.pem

virtualKeyPairingUrl({ domain: 'example.com', vin })
// https://tesla.com/_ak/example.com?vin=...
```
