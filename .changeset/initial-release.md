---
'tesdk': minor
---

Initial release.

A universal TypeScript SDK for the [Tesla Fleet API](https://developer.tesla.com/docs/fleet-api),
built on Web Standards alone — `fetch`, `AbortSignal`, `URL`, and Web Crypto —
so one build runs on Node 20+, browsers, Deno, Bun, Cloudflare Workers, and
Vercel Edge. Zero runtime dependencies.

**Resources** — 106 typed methods across ten namespaces:

- `vehicles` — list and cursor pagination, live `vehicle_data` with subtree
  selection, wake handling, drivers, share invites, and `fleetStatus` for
  discovering which vehicles require signed commands
- `commands` — 47 commands covering locks, charging, climate, seat and steering
  heaters, media, navigation, sunroof, HomeLink, valet, speed limit, PIN to
  Drive, and charge and precondition schedules
- `energy` — Powerwall, Solar, and Wall Connector live status, site info,
  history, backup reserve, operation and storm modes, and time-of-use tariffs
- `charging` — history, sessions, and PDF invoices returned as binary
- `telemetry` — Fleet Telemetry configuration, including JWS-signed configs
- `partner` — registration, public key, and telemetry diagnostics
- `fleet` — specs, options, pricing, warranty, eligibility, enterprise roles
- `user` — profile, region discovery, orders, feature flags
- `ocpi` — Tesla Charging API locations and tariffs (OCPI 2.2.1)
- `oauth` — authorization code with PKCE, partner tokens, third-party business
  tokens, and refresh with single-flight deduplication

**Behaviour that reflects how the Fleet API actually works:**

- Regional routing across `na`, `eu`, and `cn`, with `forUserRegion()` to let
  the API report the correct host rather than guessing
- Commands with a visible physical effect are never retried automatically, so a
  transient failure cannot honk the horn twice
- `408` is never retried, because it means the vehicle is asleep and no retry
  succeeds without an explicit wake
- Waking is always explicit — `ensureAwake()` and `withWake()` — since waking
  draws down the traction battery
- `SigningRequiredError` names the Vehicle Command Proxy as the remedy for
  vehicles that reject unsigned commands
- The Charging API gets its own transport, so its `Token` scheme and host never
  leak into Fleet API requests
- Retries use exponential backoff with full jitter and honour `Retry-After`
- Every error carries `requestId` from Tesla's `x-txid` header

**Typed error hierarchy** — `TeslaError` with ten subclasses, discriminable by
`instanceof` or by a stable `code`.

**Auth** — PKCE helpers on Web Crypto, pluggable `TokenStore`, virtual-key
pairing URL and public-key path helpers.

Ships ESM and CJS with correct declarations for both, verified by publint and
are-the-types-wrong. Side-effect free and tree-shakeable.
