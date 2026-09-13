# client.commands

> Every actuating command, from locks to navigation.

Remote control commands for a vehicle.

Accessed as `client.commands`.

## Methods

### `send`

```ts
send(vin: string, command: string, body?: Record<string, unknown>, options?: SendCommandOptions): Promise<CommandResult>
```

Sends an arbitrary command, including endpoints newer than this SDK.

**Parameters**

- `vin` - Vehicle identification number.
- `command` - Command name as it appears in the Fleet API path.
- `body` - JSON body for commands that take parameters.

```ts
await client.commands.send(vin, 'set_charge_limit', { percent: 80 })
```


### `signedCommand`

```ts
signedCommand(vin: string, payload: Record<string, unknown>, options?: SendCommandOptions): Promise<CommandResult>
```

Sends a pre-signed command envelope.

The generic endpoint that replaces the individual legacy command routes,
carrying a payload already signed with the Vehicle Command Protocol. Use
it only when signing is handled outside this SDK; a Vehicle Command Proxy
signs the ordinary command methods for you.

**Parameters**

- `payload` - Signed protocol message.

See: https://github.com/teslamotors/vehicle-command


### `doorLock`

```ts
doorLock(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `doorUnlock`

```ts
doorUnlock(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `honkHorn`

```ts
honkHorn(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```

Sounds the horn.

Never retried automatically, since a repeat would honk twice.


### `flashLights`

```ts
flashLights(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `chargeStart`

```ts
chargeStart(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `chargeStop`

```ts
chargeStop(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `setChargeLimit`

```ts
setChargeLimit(vin: string, percent: number, options?: SendCommandOptions): Promise<CommandResult>
```

Sets the charge limit.

**Parameters**

- `percent` - Target state of charge, from 50 to 100.


### `setChargingAmps`

```ts
setChargingAmps(vin: string, chargingAmps: number, options?: SendCommandOptions): Promise<CommandResult>
```

Sets the charging current.

**Parameters**

- `chargingAmps` - Requested amperage, clamped by the vehicle to what
the connected circuit supports.


### `chargePortDoorOpen`

```ts
chargePortDoorOpen(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `chargePortDoorClose`

```ts
chargePortDoorClose(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `climateStart`

```ts
climateStart(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `climateStop`

```ts
climateStop(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `setTemps`

```ts
setTemps(vin: string, options: SetTempsOptions): Promise<CommandResult>
```

Sets driver and passenger temperature targets.

```ts
await client.commands.setTemps(vin, { driverTemp: 21 })
```


### `setSeatHeater`

```ts
setSeatHeater(vin: string, seat: SeatPosition, level: 0 | 1 | 2 | 3, options?: SendCommandOptions): Promise<CommandResult>
```

Sets a seat heater level.

**Parameters**

- `level` - `0` for off through `3` for maximum.


### `setSentryMode`

```ts
setSentryMode(vin: string, on: boolean, options?: SendCommandOptions): Promise<CommandResult>
```


### `actuateTrunk`

```ts
actuateTrunk(vin: string, which: 'front' | 'rear', options?: SendCommandOptions): Promise<CommandResult>
```

Actuates the front or rear trunk.

The rear trunk toggles on vehicles with a powered liftgate, so repeated
calls are not idempotent and are never retried.

**Parameters**

- `which` - `front` for the frunk, `rear` for the trunk.


### `windowControl`

```ts
windowControl(vin: string, command: 'vent' | 'close', position?: {
```

Vents or closes the windows of a parked vehicle.

Closing requires the user's coordinates so the vehicle can confirm they
are nearby. Model 3 is exempt from that check, which is why the
coordinates are optional.

**Parameters**

- `position` - User latitude and longitude, required to close on most
platforms.


### `sunRoofControl`

```ts
sunRoofControl(vin: string, state: 'stop' | 'close' | 'vent', options?: SendCommandOptions): Promise<CommandResult>
```


### `triggerHomelink`

```ts
triggerHomelink(vin: string, position: {
```


### `setBioweaponMode`

```ts
setBioweaponMode(vin: string, on: boolean, options?: SendCommandOptions): Promise<CommandResult>
```


### `setClimateKeeperMode`

```ts
setClimateKeeperMode(vin: string, mode: 0 | 1 | 2 | 3, options?: SendCommandOptions): Promise<CommandResult>
```

Sets Climate Keeper mode.

**Parameters**

- `mode` - `0` off, `1` Keep, `2` Dog, `3` Camp.


### `setCabinOverheatProtection`

```ts
setCabinOverheatProtection(vin: string, settings: {
```


### `setValetMode`

```ts
setValetMode(vin: string, on: boolean, password?: string, options?: SendCommandOptions): Promise<CommandResult>
```

Turns on Valet Mode with a four-digit passcode.

**Parameters**

- `password` - Four-digit passcode required to exit Valet Mode.


### `speedLimitActivate`

```ts
speedLimitActivate(vin: string, pin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `speedLimitDeactivate`

```ts
speedLimitDeactivate(vin: string, pin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `speedLimitSetLimit`

```ts
speedLimitSetLimit(vin: string, limitMph: number, options?: SendCommandOptions): Promise<CommandResult>
```


### `mediaTogglePlayback`

```ts
mediaTogglePlayback(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```

Toggles media playback.

Media commands are never retried, since a repeat would skip an extra track
or toggle playback back to its previous state.


### `mediaNextTrack`

```ts
mediaNextTrack(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `mediaPrevTrack`

```ts
mediaPrevTrack(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `adjustVolume`

```ts
adjustVolume(vin: string, volume: number, options?: SendCommandOptions): Promise<CommandResult>
```

Sets media playback volume.

Requires the user to be present and mobile access to be enabled.

**Parameters**

- `volume` - Level from 0 to 11.


### `navigationGpsRequest`

```ts
navigationGpsRequest(vin: string, position: {
```


### `navigationSuperchargerRequest`

```ts
navigationSuperchargerRequest(vin: string, id: number, options?: SendCommandOptions): Promise<CommandResult>
```


### `addChargeSchedule`

```ts
addChargeSchedule(vin: string, schedule: Record<string, unknown>, options?: SendCommandOptions): Promise<CommandResult>
```

Adds a charge schedule.

Preferred over `set_scheduled_charging` from firmware 2024.26 onward.
Existing schedules are readable via the `charge_schedule_data` subtree of
VehiclesResource.data.


### `removeChargeSchedule`

```ts
removeChargeSchedule(vin: string, id: number, options?: SendCommandOptions): Promise<CommandResult>
```


### `addPreconditionSchedule`

```ts
addPreconditionSchedule(vin: string, schedule: Record<string, unknown>, options?: SendCommandOptions): Promise<CommandResult>
```


### `removePreconditionSchedule`

```ts
removePreconditionSchedule(vin: string, id: number, options?: SendCommandOptions): Promise<CommandResult>
```


### `setPinToDrive`

```ts
setPinToDrive(vin: string, pin: string, options?: SendCommandOptions): Promise<CommandResult>
```

Sets a four-digit PIN to Drive passcode.

Requires Vehicle Command Protocol signing, and is restricted to fleet
managers and owners. The vehicle retains the first PIN it is given, so
changing it requires resetPinToDrive first.


### `resetPinToDrive`

```ts
resetPinToDrive(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```

Clears PIN to Drive.

Requires Vehicle Command Protocol signing, and works only while PIN to
Drive is inactive and the vehicle is not in Valet Mode.


### `setGuestMode`

```ts
setGuestMode(vin: string, enable: boolean, options?: SendCommandOptions): Promise<CommandResult>
```


### `remoteBoombox`

```ts
remoteBoombox(vin: string, sound: 0 | 2000, options?: SendCommandOptions): Promise<CommandResult>
```

Plays a sound through the external speaker.

**Parameters**

- `sound` - `0` for the random fart, `2000` for the locate ping.


### `remoteStartDrive`

```ts
remoteStartDrive(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


### `setVehicleName`

```ts
setVehicleName(vin: string, name: string, options?: SendCommandOptions): Promise<CommandResult>
```

Sets the vehicle name.

Requires Vehicle Command Protocol signing on all supported vehicles.


### `navigationRequest`

```ts
navigationRequest(vin: string, value: string, options?: SendCommandOptions): Promise<CommandResult>
```

Shares a destination, address, or search query with the navigation system.

**Parameters**

- `value` - An address, a `latitude,longitude` pair, or a share URL.


### `scheduleSoftwareUpdate`

```ts
scheduleSoftwareUpdate(vin: string, offsetSeconds: number, options?: SendCommandOptions): Promise<CommandResult>
```


### `cancelSoftwareUpdate`

```ts
cancelSoftwareUpdate(vin: string, options?: SendCommandOptions): Promise<CommandResult>
```


