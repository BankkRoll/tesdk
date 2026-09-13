/**
 * @file Actuating vehicle commands.
 *
 * Every method posts to `/api/1/vehicles/{vin}/command/{name}` and resolves to
 * a {@link CommandResult}. A `result: false` payload is a rejection by the
 * vehicle rather than a transport failure, so it resolves instead of throwing;
 * use {@link CommandsResource.send} with `throwOnFailure` to invert that.
 *
 * Vehicles built from 2021 onward reject unsigned commands. Point the client
 * `baseUrl` at a Vehicle Command Proxy to have requests signed, otherwise
 * these methods raise {@link SigningRequiredError}.
 *
 * @see {@link https://github.com/teslamotors/vehicle-command}
 */

import { TeslaError } from '../core/errors.js'
import type { RequestOverrides } from '../types/common.js'
import type { CommandResult } from '../types/vehicles.js'
import { BaseResource, assertVin } from './base.js'

/** Options accepted by {@link CommandsResource.send}. */
export interface SendCommandOptions extends RequestOverrides {
  /**
   * Whether the command may be retried after a transient failure.
   *
   * Left `false` for commands with a visible physical effect, where a retry
   * could double-actuate.
   *
   * @defaultValue `false`
   */
  idempotent?: boolean
  /**
   * Throw a {@link TeslaError} when the vehicle returns `result: false`.
   *
   * @defaultValue `false`
   */
  throwOnFailure?: boolean
}

/** Temperature settings for {@link CommandsResource.setTemps}. */
export interface SetTempsOptions extends SendCommandOptions {
  /** Driver-side target in Celsius. */
  driverTemp: number
  /** Passenger-side target in Celsius. Defaults to `driverTemp`. */
  passengerTemp?: number
}

/**
 * Seat positions accepted by {@link CommandsResource.setSeatHeater}.
 *
 * Declared as a const object rather than an `enum` so the module remains
 * erasable by type-stripping runtimes and tree-shakes when unused.
 */
export const SeatPosition = {
  FrontLeft: 0,
  FrontRight: 1,
  RearLeft: 2,
  RearCenter: 4,
  RearRight: 5,
} as const

/** Seat position value accepted by {@link CommandsResource.setSeatHeater}. */
export type SeatPosition = (typeof SeatPosition)[keyof typeof SeatPosition]

/**
 * Remote control commands for a vehicle.
 *
 * Accessed as `client.commands`.
 */
export class CommandsResource extends BaseResource {
  /**
   * Sends an arbitrary command, including endpoints newer than this SDK.
   *
   * @param vin - Vehicle identification number.
   * @param command - Command name as it appears in the Fleet API path.
   * @param body - JSON body for commands that take parameters.
   *
   * @example
   * ```ts
   * await client.commands.send(vin, 'set_charge_limit', { percent: 80 })
   * ```
   */
  async send(
    vin: string,
    command: string,
    body?: Record<string, unknown>,
    options: SendCommandOptions = {},
  ): Promise<CommandResult> {
    const { idempotent = false, throwOnFailure = false, ...overrides } = options
    const result = await this.unwrap<CommandResult>({
      method: 'POST',
      path: `/api/1/vehicles/${assertVin(vin)}/command/${command}`,
      idempotent,
      ...(body !== undefined ? { body } : {}),
      ...overrides,
    })

    // Only an explicit `false` is a rejection; an absent field means the
    // vehicle returned a payload that carries no result flag.
    if (throwOnFailure && result.result === false) {
      throw new TeslaError(
        `Command ${command} was rejected: ${result.reason ?? 'unknown reason'}`,
        {
          body: result,
        },
      )
    }
    return result
  }

  /**
   * Sends a pre-signed command envelope.
   *
   * The generic endpoint that replaces the individual legacy command routes,
   * carrying a payload already signed with the Vehicle Command Protocol. Use
   * it only when signing is handled outside this SDK; a Vehicle Command Proxy
   * signs the ordinary command methods for you.
   *
   * @param payload - Signed protocol message.
   *
   * @see {@link https://github.com/teslamotors/vehicle-command}
   */
  async signedCommand(
    vin: string,
    payload: Record<string, unknown>,
    options: SendCommandOptions = {},
  ): Promise<CommandResult> {
    const { idempotent = false, ...overrides } = options
    return await this.unwrap<CommandResult>({
      method: 'POST',
      path: `/api/1/vehicles/${assertVin(vin)}/signed_command`,
      body: payload,
      idempotent,
      ...overrides,
    })
  }

  /**
   * Sends a command that is safe to repeat.
   *
   * Used for state-setting commands whose effect is the same whether applied
   * once or twice, such as locking a door.
   *
   * @internal
   */
  private sendIdempotent(
    vin: string,
    command: string,
    body?: Record<string, unknown>,
    options: SendCommandOptions = {},
  ): Promise<CommandResult> {
    return this.send(vin, command, body, { idempotent: true, ...options })
  }

  /** Locks the doors. */
  doorLock(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'door_lock', undefined, options)
  }

  /** Unlocks the doors. */
  doorUnlock(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'door_unlock', undefined, options)
  }

  /**
   * Sounds the horn.
   *
   * Never retried automatically, since a repeat would honk twice.
   */
  honkHorn(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.send(vin, 'honk_horn', undefined, options)
  }

  /** Flashes the exterior lights. */
  flashLights(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.send(vin, 'flash_lights', undefined, options)
  }

  /** Begins charging when the vehicle is plugged in. */
  chargeStart(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'charge_start', undefined, options)
  }

  /** Stops an active charging session. */
  chargeStop(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'charge_stop', undefined, options)
  }

  /**
   * Sets the charge limit.
   *
   * @param percent - Target state of charge, from 50 to 100.
   */
  setChargeLimit(
    vin: string,
    percent: number,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'set_charge_limit', { percent }, options)
  }

  /**
   * Sets the charging current.
   *
   * @param chargingAmps - Requested amperage, clamped by the vehicle to what
   * the connected circuit supports.
   */
  setChargingAmps(
    vin: string,
    chargingAmps: number,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'set_charging_amps', { charging_amps: chargingAmps }, options)
  }

  /** Opens the charge port door, or unlocks the cable when already open. */
  chargePortDoorOpen(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'charge_port_door_open', undefined, options)
  }

  /** Closes the charge port door on vehicles with a motorized port. */
  chargePortDoorClose(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'charge_port_door_close', undefined, options)
  }

  /** Starts climate control preconditioning. */
  climateStart(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'auto_conditioning_start', undefined, options)
  }

  /** Stops climate control. */
  climateStop(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'auto_conditioning_stop', undefined, options)
  }

  /**
   * Sets driver and passenger temperature targets.
   *
   * @example
   * ```ts
   * await client.commands.setTemps(vin, { driverTemp: 21 })
   * ```
   */
  setTemps(vin: string, options: SetTempsOptions): Promise<CommandResult> {
    const { driverTemp, passengerTemp, ...rest } = options
    return this.sendIdempotent(
      vin,
      'set_temps',
      { driver_temp: driverTemp, passenger_temp: passengerTemp ?? driverTemp },
      rest,
    )
  }

  /**
   * Sets a seat heater level.
   *
   * @param level - `0` for off through `3` for maximum.
   */
  setSeatHeater(
    vin: string,
    seat: SeatPosition,
    level: 0 | 1 | 2 | 3,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'remote_seat_heater_request', { heater: seat, level }, options)
  }

  /** Enables or disables Sentry Mode. */
  setSentryMode(vin: string, on: boolean, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'set_sentry_mode', { on }, options)
  }

  /**
   * Actuates the front or rear trunk.
   *
   * The rear trunk toggles on vehicles with a powered liftgate, so repeated
   * calls are not idempotent and are never retried.
   *
   * @param which - `front` for the frunk, `rear` for the trunk.
   */
  actuateTrunk(
    vin: string,
    which: 'front' | 'rear',
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.send(vin, 'actuate_trunk', { which_trunk: which }, options)
  }

  /**
   * Vents or closes the windows of a parked vehicle.
   *
   * Closing requires the user's coordinates so the vehicle can confirm they
   * are nearby. Model 3 is exempt from that check, which is why the
   * coordinates are optional.
   *
   * @param position - User latitude and longitude, required to close on most
   * platforms.
   */
  windowControl(
    vin: string,
    command: 'vent' | 'close',
    position?: { lat: number; lon: number },
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(
      vin,
      'window_control',
      { command, lat: position?.lat ?? 0, lon: position?.lon ?? 0 },
      options,
    )
  }

  /** Opens, vents, or stops the sunroof on equipped vehicles. */
  sunRoofControl(
    vin: string,
    state: 'stop' | 'close' | 'vent',
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'sun_roof_control', { state }, options)
  }

  /** Triggers HomeLink, typically to operate a garage door. */
  triggerHomelink(
    vin: string,
    position: { lat: number; lon: number },
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.send(vin, 'trigger_homelink', { lat: position.lat, lon: position.lon }, options)
  }

  /** Turns Bioweapon Defense Mode on or off. */
  setBioweaponMode(vin: string, on: boolean, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'set_bioweapon_mode', { on, manual_override: true }, options)
  }

  /**
   * Sets Climate Keeper mode.
   *
   * @param mode - `0` off, `1` Keep, `2` Dog, `3` Camp.
   */
  setClimateKeeperMode(
    vin: string,
    mode: 0 | 1 | 2 | 3,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(
      vin,
      'set_climate_keeper_mode',
      { climate_keeper_mode: mode },
      options,
    )
  }

  /** Enables or disables Cabin Overheat Protection, optionally with fan only. */
  setCabinOverheatProtection(
    vin: string,
    settings: { on: boolean; fanOnly?: boolean },
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(
      vin,
      'set_cabin_overheat_protection',
      { on: settings.on, fan_only: settings.fanOnly ?? false },
      options,
    )
  }

  /**
   * Turns on Valet Mode with a four-digit passcode.
   *
   * @param password - Four-digit passcode required to exit Valet Mode.
   */
  setValetMode(
    vin: string,
    on: boolean,
    password?: string,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(
      vin,
      'set_valet_mode',
      { on, ...(password !== undefined ? { password } : {}) },
      options,
    )
  }

  /** Activates Speed Limit Mode with a four-digit PIN. */
  speedLimitActivate(
    vin: string,
    pin: string,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'speed_limit_activate', { pin }, options)
  }

  /** Deactivates Speed Limit Mode. */
  speedLimitDeactivate(
    vin: string,
    pin: string,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'speed_limit_deactivate', { pin }, options)
  }

  /** Sets the Speed Limit Mode maximum, in miles per hour. */
  speedLimitSetLimit(
    vin: string,
    limitMph: number,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'speed_limit_set_limit', { limit_mph: limitMph }, options)
  }

  /**
   * Toggles media playback.
   *
   * Media commands are never retried, since a repeat would skip an extra track
   * or toggle playback back to its previous state.
   */
  mediaTogglePlayback(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.send(vin, 'media_toggle_playback', undefined, options)
  }

  /** Advances the media player to the next track. */
  mediaNextTrack(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.send(vin, 'media_next_track', undefined, options)
  }

  /** Returns the media player to the previous track. */
  mediaPrevTrack(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.send(vin, 'media_prev_track', undefined, options)
  }

  /**
   * Sets media playback volume.
   *
   * Requires the user to be present and mobile access to be enabled.
   *
   * @param volume - Level from 0 to 11.
   */
  adjustVolume(vin: string, volume: number, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'adjust_volume', { volume }, options)
  }

  /** Starts navigation to the given coordinates. */
  navigationGpsRequest(
    vin: string,
    position: { lat: number; lon: number; order?: number },
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'navigation_gps_request', position, options)
  }

  /** Starts navigation to a Supercharger by its identifier. */
  navigationSuperchargerRequest(
    vin: string,
    id: number,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'navigation_sc_request', { id, order: 0 }, options)
  }

  /**
   * Adds a charge schedule.
   *
   * Preferred over `set_scheduled_charging` from firmware 2024.26 onward.
   * Existing schedules are readable via the `charge_schedule_data` subtree of
   * {@link VehiclesResource.data}.
   */
  addChargeSchedule(
    vin: string,
    schedule: Record<string, unknown>,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'add_charge_schedule', schedule, options)
  }

  /** Removes a charge schedule by id. */
  removeChargeSchedule(
    vin: string,
    id: number,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'remove_charge_schedule', { id }, options)
  }

  /** Adds or modifies a preconditioning schedule. */
  addPreconditionSchedule(
    vin: string,
    schedule: Record<string, unknown>,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'add_precondition_schedule', schedule, options)
  }

  /** Removes a preconditioning schedule by id. */
  removePreconditionSchedule(
    vin: string,
    id: number,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'remove_precondition_schedule', { id }, options)
  }

  /**
   * Sets a four-digit PIN to Drive passcode.
   *
   * Requires Vehicle Command Protocol signing, and is restricted to fleet
   * managers and owners. The vehicle retains the first PIN it is given, so
   * changing it requires {@link resetPinToDrive} first.
   */
  setPinToDrive(vin: string, pin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'set_pin_to_drive', { on: true, password: pin }, options)
  }

  /**
   * Clears PIN to Drive.
   *
   * Requires Vehicle Command Protocol signing, and works only while PIN to
   * Drive is inactive and the vehicle is not in Valet Mode.
   */
  resetPinToDrive(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'reset_pin_to_drive_pin', undefined, options)
  }

  /** Enables or disables Guest Mode. */
  setGuestMode(vin: string, enable: boolean, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'guest_mode', { enable }, options)
  }

  /**
   * Plays a sound through the external speaker.
   *
   * @param sound - `0` for the random fart, `2000` for the locate ping.
   */
  remoteBoombox(
    vin: string,
    sound: 0 | 2000,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.send(vin, 'remote_boombox', { sound }, options)
  }

  /** Starts keyless driving, valid for two minutes. */
  remoteStartDrive(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'remote_start_drive', undefined, options)
  }

  /**
   * Sets the vehicle name.
   *
   * Requires Vehicle Command Protocol signing on all supported vehicles.
   */
  setVehicleName(vin: string, name: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'set_vehicle_name', { vehicle_name: name }, options)
  }

  /**
   * Shares a destination, address, or search query with the navigation system.
   *
   * @param value - An address, a `latitude,longitude` pair, or a share URL.
   */
  navigationRequest(
    vin: string,
    value: string,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(
      vin,
      'navigation_request',
      {
        type: 'share_ext_content_raw',
        value: { 'android.intent.extra.TEXT': value },
        locale: 'en-US',
        timestamp_ms: `${Date.now()}`,
      },
      options,
    )
  }

  /** Schedules or cancels a software update. Set `offsetSeconds` to `0` to start now. */
  scheduleSoftwareUpdate(
    vin: string,
    offsetSeconds: number,
    options?: SendCommandOptions,
  ): Promise<CommandResult> {
    return this.sendIdempotent(
      vin,
      'schedule_software_update',
      { offset_sec: offsetSeconds },
      options,
    )
  }

  /** Cancels a pending software update. */
  cancelSoftwareUpdate(vin: string, options?: SendCommandOptions): Promise<CommandResult> {
    return this.sendIdempotent(vin, 'cancel_software_update', undefined, options)
  }
}
