# Quickstart

> From an empty project to reading live vehicle data.

## 1. Install

```sh
npm install @bankkroll/tesdk
```

## 2. Register an application

Create an application at https://developer.tesla.com. You need a client ID, a
client secret for confidential clients, and at least one allowed redirect URI.

Registration is per-region: a token minted for one region is rejected by the
others, and so is a partner registration.

## 3. Authorize a user

```ts
import { TeslaClient, createPkcePair, randomString } from '@bankkroll/tesdk'

const client = new TeslaClient({
  region: 'na',
  clientId: process.env.TESLA_CLIENT_ID,
  clientSecret: process.env.TESLA_CLIENT_SECRET,
  redirectUri: 'https://example.com/callback',
})

const pkce = await createPkcePair()
const state = randomString()

// Persist both against the user's session before redirecting.
const url = client.oauth.authorizeUrl({
  scopes: ['vehicle_device_data', 'vehicle_cmds'],
  state,
  pkce,
})
```

Then exchange the code your callback receives:

```ts
const tokens = await client.oauth.exchangeCode({ code, codeVerifier: pkce.verifier })
```

## 4. Read vehicle data

```ts
const vehicles = await client.vehicles.list()

// Requesting only the subtrees you need keeps the payload small and
// shortens how long the vehicle stays awake.
const data = await client.vehicles.data(vehicles[0].vin, {
  endpoints: ['charge_state', 'climate_state'],
})
```

## 5. Send a command

```ts
await client.vehicles.withWake(vin, () => client.commands.doorLock(vin))
```

`withWake` runs the operation and, if the vehicle turns out to be asleep, wakes it
and retries exactly once.
