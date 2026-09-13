# client.telemetry

> Fleet Telemetry streaming configuration.

Fleet Telemetry configuration endpoints.

Accessed as `client.telemetry`.

## Methods

### `createConfig`

```ts
createConfig(vins: string[], config: TelemetryConfig, options?: RequestOverrides): Promise<TelemetryConfigResult>
```

Applies a telemetry configuration to a set of vehicles.

Send this through a Vehicle Command Proxy so the payload is signed. A
vehicle accepts configurations from at most five applications.

**Parameters**

- `vins` - Vehicles to configure.
- `config` - Server address and the fields to stream.

```ts
await client.telemetry.createConfig([vin], {
  hostname: 'telemetry.example.com',
  ca: caPem,
  fields: { Soc: { interval_seconds: 60 }, Location: { interval_seconds: 10 } },
})
```


### `createConfigJws`

```ts
createConfigJws(token: string, options?: RequestOverrides): Promise<TelemetryConfigResult>
```

Applies a pre-signed configuration token.

Prefer createConfig through the proxy; this endpoint exists for
callers that sign the JWS themselves using Schnorr over NIST P-256 and
SHA-256.


### `getConfig`

```ts
getConfig(vin: string, options?: RequestOverrides): Promise<TelemetryConfigStatus>
```


### `deleteConfig`

```ts
deleteConfig(vin: string, options?: RequestOverrides): Promise<TelemetryConfigResult>
```

Removes a vehicle's telemetry configuration.

A partner token removes the configuration from any vehicle; a third-party
token is limited to vehicles it has been granted access to.


### `errors`

```ts
errors(vin: string, options?: RequestOverrides): Promise<FleetTelemetryError[]>
```


