# client.ocpi

> Tesla Charging API locations and tariffs (OCPI 2.2.1).

Tesla Charging API (OCPI 2.2.1) endpoints.

Accessed as `client.ocpi`. Requires a client constructed with an OCPI token
and the OCPI base URL supplied by Tesla during the credentials handshake.

```ts
const client = new TeslaClient({
  baseUrl: 'https://ocpi.tesla.com',
  ocpiToken: process.env.TESLA_OCPI_TOKEN,
})
const locations = await client.ocpi.locations({ limit: 100 })
```

## Methods

### `locations`

```ts
locations(options?: OcpiPageOptions): Promise<Location[]>
```

Lists charging locations visible to the configured scope.

Results are paged; combine `offset` and `limit`, or use
listAllLocations to iterate.


### `location`

```ts
location(locationId: string, options?: RequestOverrides): Promise<Location>
```


### `listAllLocations`

```ts
listAllLocations(options?: OcpiPageOptions): AsyncGenerator<Location, void, undefined>
```

Iterates every location, requesting pages lazily.

**Parameters**

- `options` - Paging controls; `limit` sets the page size.


### `tariffs`

```ts
tariffs(options?: OcpiPageOptions): Promise<Tariff[]>
```


### `versionDetails`

```ts
versionDetails(options?: RequestOverrides): Promise<VersionDetails>
```


### `credentials`

```ts
credentials(options?: RequestOverrides): Promise<Credentials>
```

Returns the credentials currently registered for this connection.

Part of the OCPI credentials handshake, which is initiated from the Tesla
developer portal with a `CREDENTIALS_TOKEN_A`.


