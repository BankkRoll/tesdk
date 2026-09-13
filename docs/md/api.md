# API reference

> Generated from the shipped type declarations, so it always matches the
> installed version.

## Client

```ts
const client = new TeslaClient({
  region: 'na',                    // 'na' | 'eu' | 'cn'
  accessToken,                     // or tokens / tokenStore for auto-refresh
  baseUrl,                         // Vehicle Command Proxy address
  ocpiToken, ocpiBaseUrl,          // Charging API, a separate product
  timeoutMs: 30_000,
  retry: { maxRetries: 2, initialDelayMs: 500, maxDelayMs: 8_000 },
  onRequest: (info) => logger.info(info),
})
```

## Namespaces

- [client.vehicles](./api-vehicles.md) (19 methods) — Listing, live data, wake handling, drivers, and share invites.
- [client.commands](./api-commands.md) (47 methods) — Every actuating command, from locks to navigation.
- [client.energy](./api-energy.md) (12 methods) — Powerwall, Solar, and Wall Connector sites.
- [client.charging](./api-charging.md) (3 methods) — Charging history, sessions, and PDF invoices.
- [client.telemetry](./api-telemetry.md) (5 methods) — Fleet Telemetry streaming configuration.
- [client.partner](./api-partner.md) (4 methods) — Partner registration and telemetry diagnostics.
- [client.fleet](./api-fleet.md) (7 methods) — Specs, options, pricing, warranty, and eligibility.
- [client.user](./api-user.md) (4 methods) — Account profile, region discovery, and orders.
- [client.ocpi](./api-ocpi.md) (6 methods) — Tesla Charging API locations and tariffs (OCPI 2.2.1).
- [client.oauth](./api-oauth.md) (6 methods) — Token flows and credential lifecycle.

Plus 86 exported types: see [Types](./types.md).
