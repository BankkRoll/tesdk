# Vite SPA

A Vite + React single-page app built on [tesdk](../../). Signs in with OAuth
PKCE from the browser, holds no client secret, and reaches Fleet API through a
development proxy — because it has to.

## Tesla sends no CORS headers

This is the constraint that shapes the whole example, so it is worth being
blunt about it: **a browser cannot call Fleet API directly.** Tesla's endpoints
answer no preflight and send no `Access-Control-Allow-Origin`, so the request
is blocked before it leaves the browser. The same is true of the OAuth token
endpoint. No SDK option, fetch flag, or client configuration changes that.

Every browser integration therefore needs a server hop, and this example makes
that hop explicit rather than hiding it:

```
browser ──same origin──▶ dev proxy ──▶ fleet-api.prd.na.vn.cloud.tesla.com
                                  └──▶ fleet-auth.prd.vn.cloud.tesla.com
```

[`dev-proxy.ts`](dev-proxy.ts) is a Vite plugin adding two same-origin routes to
the dev server:

| Route          | Forwards to                                          |
| -------------- | ---------------------------------------------------- |
| `/tesla/*`     | Fleet API, or `TESLA_PROXY_URL` when set             |
| `/oauth/token` | The regional token endpoint                          |

The SDK is pointed at them in [`src/lib/client.ts`](src/lib/client.ts):
`baseUrl` redirects Fleet API, and a wrapping `fetch` rewrites the one absolute
token URL the SDK holds as a constant.

The proxy adds no credentials. It exists purely to satisfy the same-origin
policy, and it forwards the browser's own `Authorization` header.

### In production this must be a real backend

`vite dev` is not a server you deploy. Replace the plugin with a backend you
own, and take the opportunity to move the session there too:

- **Never ship a client secret to a browser.** This example is registered as an
  OAuth *public client* and authenticates with PKCE, so there is no secret to
  leak. If your application is confidential, the token exchange belongs on the
  server and the browser must never see the secret.
- **Prefer an httpOnly cookie over `sessionStorage`.** Tokens here are readable
  by any script on the origin, which means an XSS bug is a token compromise.
  [`src/lib/session.ts`](src/lib/session.ts) is the seam where that swap
  happens. The [Next.js example](../nextjs-app) shows the cookie-based shape.
- **Keep the allowlist.** [`src/lib/commands.ts`](src/lib/commands.ts) is a
  closed table of runnable commands. Once a backend is doing the forwarding,
  that table belongs on it, or the endpoint becomes a proxy for every Fleet API
  command the session's scopes permit.

## Setup

```sh
npm install                 # from the repository root
cp .env.example .env.local  # then fill in VITE_TESLA_CLIENT_ID
npm run dev
```

Open <http://localhost:5173>. Register `http://localhost:5173/callback` as an
allowed redirect URI on your Tesla application first, or the callback is
rejected.

## Environment

| Variable                  | Required                | Description                                             |
| ------------------------- | ----------------------- | ------------------------------------------------------- |
| `VITE_TESLA_CLIENT_ID`    | yes                     | Application client id                                    |
| `VITE_TESLA_REGION`       | no                      | `na`, `eu`, or `cn`. Defaults to `na`                    |
| `VITE_TESLA_REDIRECT_URI` | no                      | Defaults to `http://localhost:5173/callback`             |
| `TESLA_PROXY_URL`         | for signed commands     | Vehicle Command Proxy address the dev proxy forwards to  |
| `TESLA_PROXY_INSECURE`    | no                      | Set to `1` to accept the proxy's self-signed certificate |

Only `VITE_`-prefixed variables reach the browser. `TESLA_PROXY_URL` is read by
the Vite config and stays in Node, which is what keeps server-only values out
of the bundle.

## Signed commands

Vehicles from 2021 onward reject unsigned commands and raise
`SigningRequiredError`, which the UI surfaces along with the remedy. Signing
happens over the Tesla Vehicle Command Protocol — protobuf re-encoded and
signed with your private key — so no HTTP proxy can do it. Run Tesla's
[Vehicle Command Proxy](https://github.com/teslamotors/vehicle-command) and
point the dev proxy at it:

```sh
TESLA_PROXY_URL=https://localhost:4443 TESLA_PROXY_INSECURE=1 npm run dev
```

Nothing in the app changes; only the upstream host does.

## What this example shows

- **PKCE in a public client** — [`src/hooks/use-auth.ts`](src/hooks/use-auth.ts)
  mints the verifier and `state`, stores both for the redirect, rejects a
  callback whose `state` does not match, and guards the single-use code against
  React's Strict Mode double-invoke
- **Working around CORS honestly** — [`dev-proxy.ts`](dev-proxy.ts) streams
  both upstreams through the dev server and preserves `x-txid`, so
  `TeslaError.requestId` still carries the value Tesla support asks for
- **Automatic refresh in the browser** — a `TokenStore` over `sessionStorage`
  writes each rotated refresh token back, so the session outlives the access
  token
- **A sleeping vehicle is a state, not an error** —
  [`vehicle-detail.tsx`](src/components/vehicle-detail.tsx) catches
  `VehicleAsleepError` and renders a wake button in place of an error
- **Rejection vs. failure** — a `result: false` payload reports the vehicle's
  reason rather than throwing, in
  [`use-command.ts`](src/hooks/use-command.ts)
- **Cancellation** — [`use-async.ts`](src/hooks/use-async.ts) threads an
  `AbortSignal` into every SDK call, so leaving a screen aborts its request
- **Closed command allowlist** — [`commands.ts`](src/lib/commands.ts) is the
  only place a Fleet API command name appears

## Files

```
dev-proxy.ts               Vite plugin forwarding Fleet API and OAuth upstream
vite.config.ts             React plugin and dev-proxy wiring
src/
  main.tsx                 Mount point and configuration error boundary
  app.tsx                  Session and route branching
  components/
    sign-in.tsx            Unauthenticated landing screen
    vehicle-list.tsx       Card grid from the non-waking list endpoint
    vehicle-detail.tsx     Live status, wake handling, controls
    vehicle-controls.tsx   Command grid and charge-limit slider
    vehicle-status.tsx     Battery gauge, state badge, detail rows
    notice.tsx             Status and failure lines
  hooks/
    use-auth.ts            PKCE flow, callback exchange, session
    use-async.ts           Abortable loads with reload
    use-command.ts         Command execution with wake-and-retry
    use-route.ts           Two-screen router over the History API
  lib/
    client.ts              Builds the client bound to the dev proxy
    config.ts              Environment reading and validation
    session.ts             sessionStorage token and PKCE storage
    commands.ts            The closed set of runnable commands
    errors.ts              SDK errors mapped to messages and remedies
    format.ts              Range, temperature, and duration formatting
  styles/app.css           Design tokens, light and dark
```
