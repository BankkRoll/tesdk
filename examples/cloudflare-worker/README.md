# Cloudflare Worker

A scheduled fleet monitor and JSON API built on [tesdk](../../), running at the
edge. A cron trigger polls charge state into Workers KV; a `fetch` handler
serves that data, runs commands, and hosts the OAuth callback.

No `nodejs_compat` flag. The SDK uses only `fetch`, `AbortSignal`, `URL`, and
Web Crypto, so it runs on Workers unmodified.

## Setup

```sh
npm install                          # from the repository root
wrangler kv namespace create TESLA_KV
wrangler kv namespace create TESLA_KV --preview
```

Put the two printed ids into `wrangler.toml` as `id` and `preview_id`, set
`TESLA_CLIENT_ID` under `[vars]`, then add the secrets:

```sh
wrangler secret put TESLA_CLIENT_SECRET
wrangler secret put API_TOKEN          # any random string; guards this Worker's API
```

For local development, copy `.dev.vars.example` to `.dev.vars` and fill in the
same two values. `.dev.vars` is gitignored.

## Authorize

The Worker runs unattended, so it authorizes once as an operator and reuses the
refresh token from then on:

```sh
wrangler dev                          # then open http://localhost:8787/auth/login
```

Register the redirect URI on your Tesla application first — locally that is
`http://localhost:8787/auth/callback`, and in production your deployed hostname.
The callback writes the token set to KV, and every later invocation refreshes
from there.

## Deploy

```sh
wrangler deploy
wrangler tail                         # live logs, including each cron run
```

## The cron schedule

```toml
[triggers]
crons = ["*/15 * * * *"]
```

Every 15 minutes the `scheduled` handler lists the fleet and reads
`charge_state` for each **online** vehicle, three at a time, writing the result
to KV under `snapshot:<vin>`.

Sleeping vehicles are skipped rather than woken. Waking a car every quarter hour
to read its battery level would drain the battery it is reporting on. Each poll
of an online vehicle is one billable `vehicle_data` call, so widen the interval
before pointing this at a real fleet — or switch to Fleet Telemetry, which
streams instead of polling.

The handler never throws: a throwing cron handler is retried by the platform, so
a persistently failing account would be retried forever. Failures are recorded
in the run summary and surfaced at `/api/health`.

## API

Every route except `/`, `/auth/login`, and `/auth/callback` requires
`Authorization: Bearer $API_TOKEN`.

| Route                                      | Description                                              |
| ------------------------------------------ | -------------------------------------------------------- |
| `GET /`                                    | Service description and whether the Worker is authorized |
| `GET /api/health`                          | Outcome of the most recent scheduled run                 |
| `GET /api/snapshots`                       | Charge readings recorded by the monitor, from KV only    |
| `GET /api/vehicles`                        | Fleet listing with each vehicle's last recorded reading  |
| `GET /api/vehicles/{vin}`                  | Live charge and climate state                            |
| `POST /api/vehicles/{vin}/commands/{name}` | `lock`, `unlock`, `charge-start`, `charge-stop`, `flash` |

```sh
curl -H "Authorization: Bearer $API_TOKEN" http://localhost:8787/api/vehicles
curl -XPOST -H "Authorization: Bearer $API_TOKEN" \
  http://localhost:8787/api/vehicles/$VIN/commands/lock
```

`GET /api/vehicles/{vin}` does not wake a sleeping vehicle; it falls back to the
monitor's last recorded reading and sets `"live": false`. Pass `?wake=1` to wake
it and read live state instead. Commands always wake, because a command is a
deliberate request for something to happen.

Runnable commands are a closed allowlist:

```ts
const COMMANDS = {
  lock: (client, vin) => client.commands.doorLock(vin),
  unlock: (client, vin) => client.commands.doorUnlock(vin),
  // …
}
```

Without it, anyone holding the API token could invoke every command the granted
scopes permit.

## Why KV holds the tokens

Workers are stateless. An isolate is discarded between invocations, and the cron
run that rotates a refresh token does not share memory with the HTTP request
that needs it minutes later — `MemoryTokenStore` would lose it every time. The
KV-backed `TokenStore` in [`src/store.ts`](src/store.ts) makes the rotated token
durable before the refresh that produced it completes:

```ts
export function kvTokenStore(kv: KVNamespace): TokenStore {
  return createTokenStore({
    get: async () => (await kv.get<TokenSet>('tesla:tokens', 'json')) ?? undefined,
    set: async (tokens) => await kv.put('tesla:tokens', JSON.stringify(tokens)),
    clear: async () => await kv.delete('tesla:tokens'),
  })
}
```

KV is eventually consistent across colos, which is fine here because Tesla
accepts the previous refresh token during a short grace window. A deployment
with concurrent writers in several regions wants a Durable Object or D1 instead.

## Errors

[`src/http.ts`](src/http.ts) maps the `TeslaError` hierarchy onto status codes:

| Error                  | Status | Response                                     |
| ---------------------- | ------ | -------------------------------------------- |
| `InvalidRequestError`  | 400    | —                                            |
| `AuthenticationError`  | 401    | Remedy: re-authorize at `/auth/login`        |
| `PermissionError`      | 403    | —                                            |
| `NotFoundError`        | 404    | —                                            |
| `VehicleAsleepError`   | 409    | Remedy: wake the vehicle, then retry         |
| `RateLimitError`       | 429    | `Retry-After` header from `error.retryAfter` |
| `SigningRequiredError` | 501    | Remedy: run the Vehicle Command Proxy        |
| `ServerError`          | 502    | —                                            |
| `TimeoutError`         | 504    | —                                            |

`VehicleAsleepError` becomes 409 rather than Tesla's 408 because 408 invites
intermediaries to retry a request that cannot succeed unchanged.

Every body carries the stable `code` and, when Tesla sent one, the `requestId`
from `x-txid` that Tesla support asks for.

## Signed commands

Vehicles from 2021 onward reject unsigned commands and raise
`SigningRequiredError`, returned here as a 501 with the remedy. Run Tesla's
[Vehicle Command Proxy](https://github.com/teslamotors/vehicle-command) and set
`TESLA_PROXY_URL` to its address; nothing else changes.

## Configuration

| Binding               | Kind         | Description                                   |
| --------------------- | ------------ | --------------------------------------------- |
| `TESLA_KV`            | KV namespace | Tokens, snapshots, and the last run summary   |
| `TESLA_CLIENT_ID`     | var          | Application client id                         |
| `TESLA_REGION`        | var          | `na`, `eu`, or `cn`. Defaults to `na`         |
| `TESLA_REDIRECT_URI`  | var          | Must match one registered on your application |
| `TESLA_PROXY_URL`     | var          | Vehicle Command Proxy address, or empty       |
| `TESLA_CLIENT_SECRET` | secret       | Application secret                            |
| `API_TOKEN`           | secret       | Bearer token guarding this Worker's API       |

## What this example shows

- **Zero Node dependencies** — no `nodejs_compat` flag, no polyfills, no
  bundler shims; the same SDK build that runs on Node runs here
- **Web Crypto PKCE** — `createPkcePair` uses `crypto.subtle` directly, so the
  OAuth flow in [`src/auth.ts`](src/auth.ts) needs no Node `crypto`
- **Durable tokens on a stateless runtime** — [`src/store.ts`](src/store.ts)
  implements `TokenStore` over KV so refresh survives isolate eviction
- **Fleet API from a cron trigger** — [`src/monitor.ts`](src/monitor.ts) polls
  without a browser, a server, or a process to keep alive
- **Typed bindings** — [`src/env.ts`](src/env.ts) validates every var and secret
  once per invocation, with no `any`
- **Error-to-status mapping** — [`src/http.ts`](src/http.ts) turns the typed
  error hierarchy into an HTTP contract with actionable remedies

## Files

```
src/
  index.ts     Entry point: fetch and scheduled handlers, bearer auth
  api.ts       JSON routes, URLPattern dispatch, command allowlist
  auth.ts      OAuth login and callback with PKCE state in KV
  client.ts    Per-invocation TeslaClient construction
  env.ts       Typed bindings and configuration validation
  http.ts      JSON responses and TeslaError-to-status mapping
  monitor.ts   The scheduled fleet poller
  store.ts     KV-backed TokenStore, snapshots, and run summaries
```
