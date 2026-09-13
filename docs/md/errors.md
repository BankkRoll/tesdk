# Errors

> Every failure is a `TeslaError` subclass, discriminable by class or by a stable `code`.

```ts
try {
  await client.commands.doorLock(vin)
} catch (error) {
  if (error instanceof VehicleAsleepError) await client.vehicles.ensureAwake(vin)
  else if (error instanceof RateLimitError) console.warn(`retry in ${error.retryAfter}s`)
  else if (error instanceof TeslaError) console.error(error.code, error.requestId)
}
```

| Class | Code | HTTP | Meaning |
| --- | --- | --- | --- |
| `InvalidRequestError` | `invalid_request` | 400, 422 | Malformed or rejected parameters |
| `AuthenticationError` | `authentication_error` | 401 | Token missing, expired, or rejected |
| `PermissionError` | `permission_error` | 403 | Missing scope or no access |
| `SigningRequiredError` | `signing_required` | 403 | Command needs the Vehicle Command Proxy |
| `NotFoundError` | `not_found` | 404 | Unknown VIN, site, or route |
| `VehicleAsleepError` | `vehicle_asleep` | 408 | Vehicle asleep or out of coverage |
| `RateLimitError` | `rate_limit` | 429 | Throttled; carries `retryAfter` |
| `ServerError` | `server_error` | 5xx | Tesla-side failure |
| `ConnectionError` | `connection_error` | — | DNS, TLS, socket, or CORS |
| `TimeoutError` | `timeout` | — | Deadline exceeded or caller aborted |

## Request ids

Every error carries `requestId`, read from Tesla's `x-txid` response header. It is
the identifier Tesla support asks for, and unlike a token it is safe to include in
a public bug report.

## Cancellation

Every method accepts a per-call `signal` and `timeoutMs`, composed with the client
default. A caller-initiated abort is never retried, since it was deliberate.

```ts
const controller = new AbortController()
setTimeout(() => controller.abort(), 5_000)

await client.vehicles.list({ signal: controller.signal })
```
