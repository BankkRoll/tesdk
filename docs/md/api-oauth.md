# client.oauth

> Token flows and credential lifecycle.

Token acquisition and renewal against the Tesla identity service.

A single instance is safe to share across concurrent requests: overlapping
refreshes collapse into one network call.

## Methods

### `authorizeUrl`

```ts
authorizeUrl(options: AuthorizeUrlOptions): string
```

Builds the URL that a user visits to grant access.

**Returns** — An absolute authorization URL to redirect the user to.

```ts
const pkce = await createPkcePair()
const state = randomString()
const url = oauth.authorizeUrl({ scopes: ['vehicle_device_data'], state, pkce })
```


### `exchangeCode`

```ts
exchangeCode(options: ExchangeCodeOptions): Promise<TokenSet>
```

Exchanges an authorization code for tokens and persists them to the store.

**Throws**

- {AuthenticationError} When the code is invalid or already used.


### `clientCredentials`

```ts
clientCredentials(scopes: Scope[]): Promise<TokenSet>
```

Obtains a partner token via the `client_credentials` grant.

Partner tokens represent the application itself rather than a user. They
are required for every partner endpoint, including registration, and for
the `vehicle_specs` and `vehicle_pricing_info` scopes.

**Parameters**

- `scopes` - Scopes to request.

```ts
const token = await client.oauth.clientCredentials(['openid', 'vehicle_specs'])
```


### `businessToken`

```ts
businessToken(authCode: string, scopes: Scope[]): Promise<TokenSet>
```

Obtains a third-party business token.

Uses the `client_credentials` grant with the authorization code that a
business administrator generates from the Consent Management page in Tesla
for Business. The resulting token carries no user context, so the
endpoints under `client.user` are unavailable to it.

**Parameters**

- `authCode` - Authorization code from Consent Management.
- `scopes` - Scopes granted by the business.


### `refresh`

```ts
refresh(refreshToken?: string): Promise<TokenSet>
```

Exchanges a refresh token for a new token set.

Concurrent calls share a single in-flight request, so a burst of expired
requests triggers only one refresh.

**Parameters**

- `refreshToken` - Overrides the refresh token held in the store.


### `getAccessToken`

```ts
getAccessToken(): Promise<string | undefined>
```

Returns a valid access token, refreshing it when it is expired or within
the expiry skew window.

**Returns** — The access token, or `undefined` when no credentials are stored.


