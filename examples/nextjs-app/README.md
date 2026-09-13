# Next.js dashboard

A Next.js 16 App Router dashboard built on [tesdk](../../). OAuth runs entirely
on the server, tokens live in an httpOnly cookie, and every mutation is a
Server Action.

## Setup

```sh
npm install                 # from the repository root
cp .env.example .env.local  # then fill in your credentials
npm run dev
```

Open <http://localhost:3000>. Register
`http://localhost:3000/api/auth/callback` as an allowed redirect URI on your
Tesla application first, or the callback is rejected.

## Why the server holds the token

Tesla does not send permissive CORS headers, so a browser cannot call Fleet API
directly. Every request in this app therefore runs on the server, which also
means the access token never reaches client JavaScript.

The session cookie here holds the token set directly, which keeps the example
self-contained. In production, store an opaque session id instead and keep the
refresh token in a database: a leaked cookie can then be revoked, and you are
not bound by the 4 KB cookie limit.

## Server Actions, not route handlers

Every mutation lives in [`app/actions.ts`](app/actions.ts) — sign in, sign out,
vehicle commands, and the charge limit. No `fetch` calls, no JSON plumbing, and
forms work before hydration.

Only the OAuth callback is a route handler, because Tesla redirects the browser
to a URL and that has to be a real GET endpoint.

Actions are public endpoints, so each one re-checks the session rather than
trusting a page-level guard. Runnable commands are a closed allowlist:

```ts
const COMMANDS = {
  lock: (client, vin) => client.commands.doorLock(vin),
  unlock: (client, vin) => client.commands.doorUnlock(vin),
  // …
} as const
```

Without that allowlist, a caller could invoke any Fleet API command the
session's scopes permit.

## Performance patterns

- **Streaming** — the page shell renders immediately; vehicle data arrives
  behind a `<Suspense>` boundary, so a sleeping fleet does not block first paint
- **Parallel work** — the session read starts before `searchParams` is awaited,
  so the two do not serialize
- **Transitions** — [`controls.tsx`](app/vehicles/[vin]/controls.tsx) uses
  `useTransition` instead of a manual loading flag
- **Minimal serialization** — only the fields the client renders cross the
  server/client boundary

## Handling a sleeping vehicle

`VehicleAsleepError` is an expected state, not a failure. The detail page
catches it and renders the controls with a wake button instead of an error:

```ts
catch (error) {
  if (error instanceof VehicleAsleepError) {
    return <VehicleControls vin={vin} chargeLimit={undefined} />
  }
  if (error instanceof NotFoundError) notFound()
}
```

Command actions use `withWake`, which wakes the vehicle and retries once — a
dashboard button is a deliberate user action, so the battery cost is expected.

## Signed commands

Vehicles from 2021 onward reject unsigned commands and raise
`SigningRequiredError`, which the UI surfaces with the remedy. Run Tesla's
[Vehicle Command Proxy](https://github.com/teslamotors/vehicle-command) and set
`TESLA_PROXY_URL` to its address; nothing else changes.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `TESLA_CLIENT_ID` | yes | Application client id |
| `TESLA_CLIENT_SECRET` | yes | Application secret |
| `TESLA_REGION` | no | `na`, `eu`, or `cn`. Defaults to `na` |
| `TESLA_REDIRECT_URI` | no | Defaults to `http://localhost:3000/api/auth/callback` |
| `TESLA_PROXY_URL` | for signed commands | Vehicle Command Proxy address |

## Files

```
app/
  actions.ts                    Every mutation: sign in/out, commands, charge limit
  layout.tsx                    Shell and sign-out form
  page.tsx                      Sign-in screen and streamed vehicle list
  globals.css                   Design tokens, light and dark
  api/auth/callback/route.ts    OAuth redirect target
  vehicles/[vin]/page.tsx       Live status, streamed
  vehicles/[vin]/controls.tsx   Client controls driven by transitions
lib/
  session.ts                    Cookie session and per-request client
```
