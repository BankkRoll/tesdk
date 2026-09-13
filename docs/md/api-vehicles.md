# client.vehicles

> Listing, live data, wake handling, drivers, and share invites.

Vehicle data and lifecycle operations.

Accessed as `client.vehicles`.

## Properties

### `withWake`

```ts
withWake<T>(vin: string, operation: () => Promise<T>, options?: EnsureAwakeOptions): Promise<T>
```

Runs an operation, waking the vehicle once and retrying if it was asleep.

```ts
const data = await client.vehicles.withWake(vin, () => client.vehicles.data(vin))
```


## Methods

### `list`

```ts
list(options?: ListVehiclesOptions & RequestOverrides): Promise<Vehicle[]>
```

Lists vehicles on the account.

```ts
const vehicles = await client.vehicles.list()
```


### `listAll`

```ts
listAll(options?: {
```

Iterates every vehicle on the account, requesting pages lazily.

```ts
for await (const vehicle of client.vehicles.listAll()) {
  console.log(vehicle.vin)
}
```


### `get`

```ts
get(vin: string, options?: RequestOverrides): Promise<Vehicle>
```

Retrieves a vehicle summary, including its connectivity state.

Does not wake the vehicle, making it the cheapest way to check whether a
vehicle is reachable.


### `data`

```ts
data(vin: string, options?: VehicleDataOptions): Promise<VehicleData>
```

Fetches a live snapshot from the vehicle.

Tesla treats this endpoint as billable and rate-sensitive; use Fleet
Telemetry for continuous monitoring rather than polling here.

**Throws**

- {VehicleAsleepError} When the vehicle is asleep or unreachable.

```ts
const data = await client.vehicles.data(vin, { endpoints: ['charge_state'] })
console.log(data.charge_state?.battery_level)
```


### `wakeUp`

```ts
wakeUp(vin: string, options?: RequestOverrides): Promise<Vehicle>
```

Requests that the vehicle wake from sleep.

Returns as soon as the request is accepted; the vehicle typically takes
10 to 60 seconds to report `online`. Use ensureAwake to wait.


### `ensureAwake`

```ts
ensureAwake(vin: string, options?: EnsureAwakeOptions): Promise<Vehicle>
```

Wakes the vehicle if needed and resolves once it reports `online`.

Returns immediately when the vehicle is already online, so it is safe to
call before any command.

**Throws**

- {TimeoutError} When the vehicle does not wake within `maxWaitMs`.

```ts
await client.vehicles.ensureAwake(vin)
await client.commands.doorLock(vin)
```


### `drivers`

```ts
drivers(vin: string, options?: RequestOverrides): Promise<Driver[]>
```

Returns the drivers permitted to access the vehicle.

Available only to the vehicle owner.


### `removeDriver`

```ts
removeDriver(vin: string, shareUserId: number, options?: RequestOverrides): Promise<CommandResult>
```

Revokes a driver's access to the vehicle.

Share users may remove only their own access; owners may remove any.

**Parameters**

- `shareUserId` - Identifier from a drivers entry.


### `mobileEnabled`

```ts
mobileEnabled(vin: string, options?: RequestOverrides): Promise<boolean>
```


### `nearbyChargingSites`

```ts
nearbyChargingSites(vin: string, options?: RequestOverrides): Promise<NearbyChargingSites>
```


### `recentAlerts`

```ts
recentAlerts(vin: string, options?: RequestOverrides): Promise<VehicleAlert[]>
```


### `serviceData`

```ts
serviceData(vin: string, options?: RequestOverrides): Promise<ServiceData>
```


### `specs`

```ts
specs(vin: string, options?: RequestOverrides): Promise<VehicleSpecs>
```

Returns specifications recorded at the time of sale.

Billed at a fixed rate per successful result and accessible only with a
partner token, for any VIN without owner authorization.


### `releaseNotes`

```ts
releaseNotes(vin: string, options?: RequestOverrides): Promise<ReleaseNotes>
```


### `fleetStatus`

```ts
fleetStatus(vins: string[], options?: RequestOverrides): Promise<FleetStatus>
```

Reports application-relevant state for up to a batch of VINs.

The authoritative way to discover whether a vehicle requires Vehicle
Command Protocol signing and whether this application's virtual key is
paired, rather than inferring either from model year.

**Parameters**

- `vins` - VINs to query.

```ts
const status = await client.vehicles.fleetStatus([vin])
if (status.vehicle_info?.[vin]?.vehicle_command_protocol_required) {
  // Route commands through a Vehicle Command Proxy.
}
```


### `shareInvites`

```ts
shareInvites(vin: string, options?: PageOptions & RequestOverrides): Promise<ShareInvite[]>
```

Returns the active share invites for a vehicle.

Paginated with a maximum page size of 25.


### `createShareInvite`

```ts
createShareInvite(vin: string, options?: RequestOverrides): Promise<ShareInvite>
```

Creates a single-use share invite that expires after 24 hours.

Grants driver-level app access, which excludes some owner-only features
such as Service and Roadside. Up to five drivers may be added at a time,
and the vehicle need not be online.

Never retried automatically: each call mints a distinct invite link.


### `revokeShareInvite`

```ts
revokeShareInvite(vin: string, invitationId: string, options?: RequestOverrides): Promise<CommandResult>
```


### `redeemShareInvite`

```ts
redeemShareInvite(code: string, options?: RequestOverrides): Promise<ShareInvite>
```

Redeems a share invite, granting the authenticated account app access.

**Parameters**

- `code` - Single-use code from the invite link.


