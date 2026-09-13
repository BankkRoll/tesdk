<div align="center">

# tesdk

**Universal TypeScript SDK for the [Tesla Fleet API](https://developer.tesla.com/docs/fleet-api)**

Vehicles · Commands · Energy · Charging · Telemetry · OCPI

[![npm](https://img.shields.io/npm/v/@bankkroll/tesdk?color=171a20&labelColor=171a20)](https://www.npmjs.com/package/@bankkroll/tesdk)
[![bundle](https://img.shields.io/bundlephobia/minzip/tesdk?color=171a20&labelColor=171a20&label=gzip)](https://bundlephobia.com/package/@bankkroll/tesdk)
[![types](https://img.shields.io/badge/types-included-171a20?labelColor=171a20)](https://arethetypeswrong.github.io/?p=@bankkroll/tesdk)
[![license](https://img.shields.io/npm/l/tesdk?color=171a20&labelColor=171a20)](LICENSE)

</div>

---

```sh
npm install @bankkroll/tesdk
```

```ts
import { TeslaClient } from '@bankkroll/tesdk'

const client = new TeslaClient({ region: 'na', accessToken: process.env.TESLA_TOKEN })

const [vehicle] = await client.vehicles.list()
const data = await client.vehicles.data(vehicle.vin, { endpoints: ['charge_state'] })

console.log(`${data.charge_state?.battery_level}%`)
```

## Why

- **Runs everywhere** — Web Standards only (`fetch`, `AbortSignal`, `URL`, Web Crypto). Node 20+, browsers, Deno, Bun, Cloudflare Workers, Vercel Edge
- **Zero runtime dependencies** — nothing to audit, nothing to break
- **Fully typed** — every endpoint, payload, and error, with no `any`
- **Safe by default** — non-idempotent commands are never retried, so a horn never honks twice
- **Honest about Tesla's quirks** — regional token binding, sleeping vehicles, and command signing are modelled, not hidden

## Resources

| Namespace | Covers |
| --- | --- |
| `client.vehicles` | List, live data, wake, drivers, fleet status, share invites |
| `client.commands` | Locks, charging, climate, media, navigation, security |
| `client.energy` | Powerwall, Solar, Wall Connector, tariffs |
| `client.charging` | Charging history, sessions, PDF invoices |
| `client.telemetry` | Fleet Telemetry configuration |
| `client.partner` | Registration, public key, telemetry diagnostics |
| `client.fleet` | Specs, options, pricing, warranty, eligibility |
| `client.user` | Profile, region, orders, feature flags |
| `client.ocpi` | Tesla Charging API — locations and tariffs (OCPI 2.2.1) |
| `client.oauth` | Token flows and lifecycle |

Endpoints newer than this SDK are reachable without waiting for a release:

```ts
await client.commands.send(vin, 'some_new_command', { param: 1 })
```

## Examples

Runnable applications, each with its own README:

| Example | What it shows |
| --- | --- |
| **[Node CLI](examples/node-cli)** | Browser OAuth with a loopback server, file-backed tokens, wake handling |
| **[Next.js 16](examples/nextjs-app)** | Server Actions, httpOnly cookie sessions, streaming with Suspense |
| **[Vite SPA](examples/vite-spa)** | PKCE in the browser, and the dev proxy Tesla's missing CORS headers force |
| **[Cloudflare Worker](examples/cloudflare-worker)** | Cron fleet monitor, KV token store, zero Node built-ins |

**[45 code snippets](examples/code-snippets)** — short, single-purpose, copy-pasteable:

[Auth](examples/code-snippets/auth) (8) ·
[Vehicles](examples/code-snippets/vehicles) (8) ·
[Commands](examples/code-snippets/commands) (9) ·
[Energy](examples/code-snippets/energy) (6) ·
[Telemetry](examples/code-snippets/telemetry) (4) ·
[Errors](examples/code-snippets/errors) (4) ·
[Patterns](examples/code-snippets/patterns) (6)

## Three things that trip people up

### Regions are not interchangeable

A token minted for one region is rejected by the others, so this affects correctness rather than latency.

| Region | Host | Coverage |
| --- | --- | --- |
| `na` | `fleet-api.prd.na.vn.cloud.tesla.com` | North America, Asia-Pacific |
| `eu` | `fleet-api.prd.eu.vn.cloud.tesla.com` | Europe, Middle East, Africa |
| `cn` | `fleet-api.prd.cn.vn.cloud.tesla.cn` | China |

Let the API tell you which one applies:

```ts
const client = await new TeslaClient({ accessToken }).forUserRegion()
```

### Vehicles from 2021 onward reject unsigned commands

Signing is not something an HTTP layer can do: commands are re-encoded as protobuf and signed with your private key over the Vehicle Command Protocol, and the car verifies that signature against its stored virtual key.

Ask which of your vehicles need it, then run Tesla's [Vehicle Command Proxy](https://github.com/teslamotors/vehicle-command) as a sidecar and point the client at it — nothing else changes:

```ts
await client.vehicles.fleetStatus([vin]) // vehicle_command_protocol_required?

const client = new TeslaClient({ baseUrl: 'https://localhost:4443', accessToken })
```

Unsigned commands otherwise raise `SigningRequiredError`.

### Waking a vehicle costs battery

So the SDK never does it implicitly. Opt in:

```ts
await client.vehicles.ensureAwake(vin)

// Or run an operation and retry once if the vehicle turns out to be asleep:
const data = await client.vehicles.withWake(vin, () => client.vehicles.data(vin))
```

## Errors

Every failure is a `TeslaError` subclass, discriminable by class or by a stable `code`.

```ts
try {
  await client.commands.doorLock(vin)
} catch (error) {
  if (error instanceof VehicleAsleepError) await client.vehicles.ensureAwake(vin)
  else if (error instanceof RateLimitError) console.warn(`retry in ${error.retryAfter}s`)
  else if (error instanceof TeslaError) console.error(error.code, error.requestId)
}
```

`InvalidRequestError` · `AuthenticationError` · `PermissionError` · `SigningRequiredError` · `NotFoundError` · `VehicleAsleepError` · `RateLimitError` · `ServerError` · `ConnectionError` · `TimeoutError`

`requestId` is the `x-txid` header, which Tesla support asks for.

Idempotent requests retry on 429, 425, and 5xx with exponential backoff plus full jitter, honouring `Retry-After`. 408 is never retried — it means the vehicle is asleep, and retrying without a wake cannot succeed.

→ [Error handling snippets](examples/code-snippets/errors)

## Configuration

```ts
const client = new TeslaClient({
  region: 'na',                    // 'na' | 'eu' | 'cn'
  accessToken,                     // or `tokens` / `tokenStore` for auto-refresh
  baseUrl,                         // Vehicle Command Proxy address
  timeoutMs: 30_000,
  retry: { maxRetries: 2, initialDelayMs: 500, maxDelayMs: 8_000 },
  onRequest: (info) => logger.info(info),
})
```

Every method takes a per-call `signal` and `timeoutMs`:

```ts
await client.vehicles.list({ signal: controller.signal, timeoutMs: 5_000 })
```

Authentication covers PKCE, partner tokens, business tokens, refresh, and custom stores.
→ [Auth snippets](examples/code-snippets/auth)

## Runtime support

| Runtime | |
| --- | --- |
| Node | 20+ |
| Browsers | Modern evergreen — but see the [CORS note](examples/vite-spa#tesla-sends-no-cors-headers) |
| Deno · Bun | Current |
| Cloudflare Workers · Vercel Edge | Yes, [no `nodejs_compat` needed](examples/cloudflare-worker) |

## Contributing

```sh
npm install
npm run verify   # typecheck · lint · test · build · publint · attw
```

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the standards and how to add an
endpoint. Report vulnerabilities privately — **[SECURITY.md](SECURITY.md)**.

## License

[MIT](LICENSE) © [BankkRoll](https://github.com/BankkRoll)
