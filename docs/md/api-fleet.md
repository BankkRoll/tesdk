# client.fleet

> Specs, options, pricing, warranty, and eligibility.

Vehicle product information and enterprise management.

Accessed as `client.fleet`.

See: https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-management

## Methods

### `options`

```ts
options(vin: string, options?: RequestOverrides): Promise<VehicleOptions>
```


### `eligibleSubscriptions`

```ts
eligibleSubscriptions(vin: string, options?: RequestOverrides): Promise<Eligibility>
```


### `eligibleUpgrades`

```ts
eligibleUpgrades(vin: string, options?: RequestOverrides): Promise<Eligibility>
```


### `warrantyDetails`

```ts
warrantyDetails(vin: string, options?: RequestOverrides): Promise<WarrantyDetails>
```


### `pricing`

```ts
pricing(request: PricingRequest, options?: RequestOverrides): Promise<Record<string, unknown>>
```

Returns pricing for a vehicle model in a market.

Requires the `vehicle_pricing_info` scope, which is available only to
partner tokens.


### `enterpriseRoles`

```ts
enterpriseRoles(vin: string, options?: RequestOverrides): Promise<EnterpriseRoles>
```


### `setEnterprisePayer`

```ts
setEnterprisePayer(vin: string, payer: Record<string, unknown>, options?: RequestOverrides): Promise<Record<string, unknown>>
```

Sets payer roles for a vehicle.

Requires the `enterprise_management` scope.


