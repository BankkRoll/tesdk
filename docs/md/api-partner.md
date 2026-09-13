# client.partner

> Partner registration and telemetry diagnostics.

Partner account endpoints.

Accessed as `client.partner`. Every endpoint here requires a partner token
obtained through the `client_credentials` grant; a third-party user token is
rejected.

See: https://developer.tesla.com/docs/fleet-api/endpoints/partner-endpoints

## Methods

### `register`

```ts
register(domain: string, options?: RequestOverrides): Promise<PartnerAccount>
```

Registers the application in the current region.

Must be completed once per region before third-party tokens issued for
that region are accepted. Before calling, a PEM-encoded secp256r1 public
key must be reachable at PUBLIC_KEY_PATH on the application
domain, and must remain hosted there for pairing to keep working.

**Parameters**

- `domain` - Domain hosting the public key. Must share a root domain
with an allowed origin configured on developer.tesla.com, and is shown to
users during virtual key pairing.


### `publicKey`

```ts
publicKey(domain?: string, options?: RequestOverrides): Promise<PartnerPublicKey>
```

Returns the public key registered for a domain.

A successful response confirms that register completed.

**Parameters**

- `domain` - Domain to look up. Defaults to the registered domain.


### `fleetTelemetryErrors`

```ts
fleetTelemetryErrors(options?: RequestOverrides): Promise<FleetTelemetryError[]>
```


### `fleetTelemetryErrorVins`

```ts
fleetTelemetryErrorVins(options?: RequestOverrides): Promise<string[]>
```


