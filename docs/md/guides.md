# Guides

> The parts of the Fleet API that surprise people, and how this SDK models them.

## Regions

Fleet API is partitioned into three isolated deployments. A token minted for one
is rejected by the others, so the region is a correctness concern rather than a
latency optimization.

| Region | Host | Coverage |
| --- | --- | --- |
| `na` | `fleet-api.prd.na.vn.cloud.tesla.com` | North America, Asia-Pacific |
| `eu` | `fleet-api.prd.eu.vn.cloud.tesla.com` | Europe, Middle East, Africa |
| `cn` | `fleet-api.prd.cn.vn.cloud.tesla.cn` | China |

```ts
const client = await new TeslaClient({ accessToken }).forUserRegion()
```

## Command signing

Vehicles from 2021 onward reject unsigned commands. Signing is not something an
HTTP layer can do for you: commands are re-encoded as protobuf and signed with
your private key over the Vehicle Command Protocol, and the car verifies that
signature against its stored virtual key.

```ts
const status = await client.vehicles.fleetStatus([vin])
status.vehicle_info?.[vin]?.vehicle_command_protocol_required
```

Run Tesla's Vehicle Command Proxy (https://github.com/teslamotors/vehicle-command)
as a sidecar and point the client at it. Nothing else changes:

```ts
const client = new TeslaClient({ baseUrl: 'https://localhost:4443', accessToken })
```

Never put the private key in your application process. Only the public key is ever
hosted, at `/.well-known/appspecific/com.tesla.3p.public-key.pem`.

## Waking vehicles

Waking draws down the traction battery, so the SDK never does it implicitly.

```ts
await client.vehicles.ensureAwake(vin)

// Or run an operation and retry once if the vehicle turns out to be asleep:
const data = await client.vehicles.withWake(vin, () => client.vehicles.data(vin))
```

A sleeping vehicle surfaces as `VehicleAsleepError`, which maps to HTTP 408. That
status is deliberately excluded from retries: without an explicit wake, no retry
can succeed.

## Retries and idempotency

Idempotent requests retry on 429, 425, and 5xx using exponential backoff with full
jitter, honouring `Retry-After` when present.

Commands with a visible physical effect are never retried:

| Never retried | Retried |
| --- | --- |
| `honkHorn`, `flashLights`, `actuateTrunk`, media controls, `remoteBoombox`, `createShareInvite` | `doorLock`, `setChargeLimit`, `climateStart`, and other state-setting commands |

## Fleet Telemetry

Streaming beats polling `vehicle_data` on both cost and battery drain.

```ts
await client.telemetry.createConfig([vin], {
  hostname: 'telemetry.example.com',
  ca: caPem,
  fields: {
    Soc: { interval_seconds: 60 },
    Location: { interval_seconds: 10, minimum_delta: 50 },
  },
})
```

## Browsers and CORS

Tesla sends no permissive CORS headers, so a browser cannot call Fleet API
directly. Proxy through your own backend. The SDK runs fine in a browser; the
network policy is the obstacle.

## Observability

```ts
const client = new TeslaClient({
  accessToken,
  onRequest: ({ method, url, status, attempt, durationMs }) => {
    logger.info({ method, url, status, attempt, durationMs })
  },
})
```
