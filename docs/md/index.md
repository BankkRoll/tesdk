# @bankkroll/tesdk

> Universal TypeScript SDK for the Tesla Fleet API — runs on Node, browsers, and edge runtimes.

Version 0.1.0. 122 typed methods across 10
namespaces, zero runtime dependencies, MIT licensed.

## Install

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

## Why this SDK

- **Runs everywhere.** Web Standards only: fetch, AbortSignal, URL, Web Crypto.
  Node 20+, browsers, Deno, Bun, Cloudflare Workers, Vercel Edge.
- **Zero runtime dependencies.**
- **Fully typed.** Every endpoint, payload, and error. No `any`.
- **Safe commands.** Commands with a visible physical effect are never retried,
  so a transient failure cannot honk the horn twice.
- **Honest about Tesla.** Regional token binding, sleeping vehicles, and command
  signing are modelled rather than hidden.

## Namespaces

- `client.vehicles` (19 methods) — Listing, live data, wake handling, drivers, and share invites.
- `client.commands` (47 methods) — Every actuating command, from locks to navigation.
- `client.energy` (12 methods) — Powerwall, Solar, and Wall Connector sites.
- `client.charging` (3 methods) — Charging history, sessions, and PDF invoices.
- `client.telemetry` (5 methods) — Fleet Telemetry streaming configuration.
- `client.partner` (4 methods) — Partner registration and telemetry diagnostics.
- `client.fleet` (7 methods) — Specs, options, pricing, warranty, and eligibility.
- `client.user` (4 methods) — Account profile, region discovery, and orders.
- `client.ocpi` (6 methods) — Tesla Charging API locations and tariffs (OCPI 2.2.1).
- `client.oauth` (6 methods) — Token flows and credential lifecycle.
