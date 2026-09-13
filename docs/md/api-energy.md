# client.energy

> Powerwall, Solar, and Wall Connector sites.

Energy site data and control.

Accessed as `client.energy`.

## Methods

### `products`

```ts
products(options?: RequestOverrides): Promise<Product[]>
```

Lists every product on the account, including vehicles and energy sites.

```ts
const sites = (await client.energy.products()).filter((p) => p.energy_site_id)
```


### `liveStatus`

```ts
liveStatus(siteId: number | string, options?: RequestOverrides): Promise<EnergySiteLiveStatus>
```


### `siteInfo`

```ts
siteInfo(siteId: number | string, options?: RequestOverrides): Promise<EnergySiteInfo>
```


### `energyHistory`

```ts
energyHistory(siteId: number | string, period: HistoryPeriod, options?: HistoryRangeOptions): Promise<EnergyHistory>
```

Returns site energy measurements aggregated to the requested period.

Energy values are in watt-hours.


### `backupHistory`

```ts
backupHistory(siteId: number | string, period: HistoryPeriod, options?: HistoryRangeOptions): Promise<EnergyHistory>
```


### `chargeHistory`

```ts
chargeHistory(siteId: number | string, options?: Omit<HistoryRangeOptions, 'period'>): Promise<EnergyHistory>
```

Returns Wall Connector charging history.

Energy values are in watt-hours. This endpoint takes no `period`.


### `setBackupReserve`

```ts
setBackupReserve(siteId: number | string, percent: number, options?: RequestOverrides): Promise<EnergyCommandResult>
```

Sets the reserve held back for grid outages.

**Parameters**

- `percent` - Reserve level from 0 to 100.


### `setOperationMode`

```ts
setOperationMode(siteId: number | string, mode: SiteOperationMode, options?: RequestOverrides): Promise<EnergyCommandResult>
```


### `setStormMode`

```ts
setStormMode(siteId: number | string, enabled: boolean, options?: RequestOverrides): Promise<EnergyCommandResult>
```


### `setGridImportExport`

```ts
setGridImportExport(siteId: number | string, settings: {
```


### `setOffGridVehicleChargingReserve`

```ts
setOffGridVehicleChargingReserve(siteId: number | string, percent: number, options?: RequestOverrides): Promise<EnergyCommandResult>
```


### `setTimeOfUseSettings`

```ts
setTimeOfUseSettings(siteId: number | string, tariff: Record<string, unknown>, options?: RequestOverrides): Promise<EnergyCommandResult>
```

Configures the utility rate plan used for time-of-use optimization.

The tariff must define at least one season, cover every time period
without gaps or overlaps, and use non-negative prices. Tesla publishes a
worked example alongside the endpoint documentation.

**Parameters**

- `tariff` - Tariff structure sent as `tou_settings.tariff_content_v2`.

See: https://developer.tesla.com/docs/fleet-api/endpoints/energy


