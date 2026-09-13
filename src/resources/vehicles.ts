/**
 * @file Vehicle data endpoints and lifecycle helpers.
 *
 * Covers listing, snapshots, wake handling, and the metadata endpoints under
 * `/api/1/vehicles`. Actuating commands live in {@link CommandsResource}.
 */

import { TeslaError, TimeoutError, VehicleAsleepError } from '../core/errors.js'
import { sleep } from '../core/sleep.js'
import type { PageOptions, RequestOverrides } from '../types/common.js'
import type {
  CommandResult,
  Driver,
  ListVehiclesOptions,
  NearbyChargingSites,
  ReleaseNotes,
  ServiceData,
  ShareInvite,
  Vehicle,
  VehicleAlert,
  VehicleData,
  VehicleDataEndpoint,
  VehicleSpecs,
} from '../types/vehicles.js'
import { BaseResource, assertVin } from './base.js'

/** Options for {@link VehiclesResource.data}. */
export interface VehicleDataOptions extends RequestOverrides {
  /**
   * Subtrees to fetch. Requesting only what is needed reduces payload size and
   * shortens how long the vehicle stays awake.
   *
   * @defaultValue All subtrees except `location_data`.
   */
  endpoints?: VehicleDataEndpoint[]
}

/** Options for {@link VehiclesResource.ensureAwake}. */
export interface EnsureAwakeOptions extends RequestOverrides {
  /** Total time to wait for the vehicle to report `online`. Defaults to `60000`. */
  maxWaitMs?: number
  /** Delay between connectivity checks. Defaults to `2000`. */
  pollIntervalMs?: number
}

const DEFAULT_DATA_ENDPOINTS: VehicleDataEndpoint[] = [
  'charge_state',
  'climate_state',
  'closures_state',
  'drive_state',
  'gui_settings',
  'vehicle_config',
  'vehicle_state',
]

/** Per-vehicle capability report returned by {@link VehiclesResource.fleetStatus}. */
export interface FleetStatus {
  /** VINs that accept requests from this application. */
  key_paired_vins?: string[]
  /** VINs that do not have this application's virtual key installed. */
  unpaired_vins?: string[]
  /** Per-VIN capability detail, keyed by VIN. */
  vehicle_info?: Record<string, VehicleFleetInfo>
  [key: string]: unknown
}

/** Capability detail for a single vehicle within a {@link FleetStatus}. */
export interface VehicleFleetInfo {
  /**
   * Whether the vehicle rejects unsigned commands.
   *
   * When `true`, route commands through a Vehicle Command Proxy.
   */
  vehicle_command_protocol_required?: boolean
  firmware_version?: string
  fleet_telemetry_version?: string
  /** Number of keys paired to the vehicle, of a maximum of 20. */
  total_number_of_keys?: number
  /** Whether the vehicle qualifies for discounted `vehicle_data` calls. */
  discounted_device_data?: boolean
  safety_screen_streaming_toggle_enabled?: boolean
  [key: string]: unknown
}

/**
 * Vehicle data and lifecycle operations.
 *
 * Accessed as `client.vehicles`.
 */
export class VehiclesResource extends BaseResource {
  /**
   * Lists vehicles on the account.
   *
   * @example
   * ```ts
   * const vehicles = await client.vehicles.list()
   * ```
   */
  async list(options: ListVehiclesOptions & RequestOverrides = {}): Promise<Vehicle[]> {
    const { page, perPage, ...overrides } = options
    return await this.unwrap<Vehicle[]>({
      method: 'GET',
      path: '/api/1/vehicles',
      query: { page, per_page: perPage },
      ...overrides,
    })
  }

  /**
   * Iterates every vehicle on the account, requesting pages lazily.
   *
   * @example
   * ```ts
   * for await (const vehicle of client.vehicles.listAll()) {
   *   console.log(vehicle.vin)
   * }
   * ```
   */
  async *listAll(
    options: { perPage?: number } & RequestOverrides = {},
  ): AsyncGenerator<Vehicle, void, undefined> {
    const { perPage = 100, ...overrides } = options
    for (let page = 1; ; page++) {
      const { data, pagination } = await this.unwrapPaged({
        method: 'GET',
        path: '/api/1/vehicles',
        query: { page, per_page: perPage },
        ...overrides,
      })

      if (!Array.isArray(data)) {
        throw new TeslaError('Expected an array of vehicles', { body: data })
      }

      const vehicles = data as Vehicle[]
      yield* vehicles

      // Fall back to a short page when the cursor is absent, which older
      // deployments omit.
      const hasMore = pagination ? pagination.next !== null : vehicles.length === perPage
      if (!hasMore || vehicles.length === 0) return
    }
  }

  /**
   * Retrieves a vehicle summary, including its connectivity state.
   *
   * Does not wake the vehicle, making it the cheapest way to check whether a
   * vehicle is reachable.
   */
  async get(vin: string, options: RequestOverrides = {}): Promise<Vehicle> {
    return await this.unwrap<Vehicle>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}`,
      ...options,
    })
  }

  /**
   * Fetches a live snapshot from the vehicle.
   *
   * Tesla treats this endpoint as billable and rate-sensitive; use Fleet
   * Telemetry for continuous monitoring rather than polling here.
   *
   * @throws {VehicleAsleepError} When the vehicle is asleep or unreachable.
   *
   * @example
   * ```ts
   * const data = await client.vehicles.data(vin, { endpoints: ['charge_state'] })
   * console.log(data.charge_state?.battery_level)
   * ```
   */
  async data(vin: string, options: VehicleDataOptions = {}): Promise<VehicleData> {
    const { endpoints = DEFAULT_DATA_ENDPOINTS, ...overrides } = options
    return await this.unwrap<VehicleData>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/vehicle_data`,
      query: { endpoints: endpoints.join(';') },
      ...overrides,
    })
  }

  /**
   * Requests that the vehicle wake from sleep.
   *
   * Returns as soon as the request is accepted; the vehicle typically takes
   * 10 to 60 seconds to report `online`. Use {@link ensureAwake} to wait.
   */
  async wakeUp(vin: string, options: RequestOverrides = {}): Promise<Vehicle> {
    return await this.unwrap<Vehicle>({
      method: 'POST',
      path: `/api/1/vehicles/${assertVin(vin)}/wake_up`,
      idempotent: true,
      ...options,
    })
  }

  /**
   * Wakes the vehicle if needed and resolves once it reports `online`.
   *
   * Returns immediately when the vehicle is already online, so it is safe to
   * call before any command.
   *
   * @throws {TimeoutError} When the vehicle does not wake within `maxWaitMs`.
   *
   * @example
   * ```ts
   * await client.vehicles.ensureAwake(vin)
   * await client.commands.doorLock(vin)
   * ```
   */
  async ensureAwake(vin: string, options: EnsureAwakeOptions = {}): Promise<Vehicle> {
    const { maxWaitMs = 60_000, pollIntervalMs = 2_000, ...overrides } = options

    const current = await this.get(vin, overrides)
    if (current.state === 'online') return current

    let latest = await this.wakeUp(vin, overrides)
    const deadline = Date.now() + maxWaitMs

    while (latest.state !== 'online') {
      if (Date.now() >= deadline) {
        throw new TimeoutError(`Vehicle ${vin} did not wake within ${maxWaitMs}ms`, {
          body: { state: latest.state },
        })
      }
      await sleep(pollIntervalMs, overrides.signal)
      latest = await this.get(vin, overrides)
    }

    return latest
  }

  /**
   * Runs an operation, waking the vehicle once and retrying if it was asleep.
   *
   * @typeParam T - Return type of the wrapped operation.
   *
   * @example
   * ```ts
   * const data = await client.vehicles.withWake(vin, () => client.vehicles.data(vin))
   * ```
   */
  async withWake<T>(
    vin: string,
    operation: () => Promise<T>,
    options: EnsureAwakeOptions = {},
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (!(error instanceof VehicleAsleepError)) throw error
      await this.ensureAwake(vin, options)
      return await operation()
    }
  }

  /**
   * Returns the drivers permitted to access the vehicle.
   *
   * Available only to the vehicle owner.
   */
  async drivers(vin: string, options: RequestOverrides = {}): Promise<Driver[]> {
    return await this.unwrap<Driver[]>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/drivers`,
      ...options,
    })
  }

  /**
   * Revokes a driver's access to the vehicle.
   *
   * Share users may remove only their own access; owners may remove any.
   *
   * @param shareUserId - Identifier from a {@link drivers} entry.
   */
  async removeDriver(
    vin: string,
    shareUserId: number,
    options: RequestOverrides = {},
  ): Promise<CommandResult> {
    return await this.unwrap<CommandResult>({
      method: 'DELETE',
      path: `/api/1/vehicles/${assertVin(vin)}/drivers`,
      query: { share_user_id: shareUserId },
      idempotent: true,
      ...options,
    })
  }

  /** Reports whether mobile access is enabled on the vehicle. */
  async mobileEnabled(vin: string, options: RequestOverrides = {}): Promise<boolean> {
    return await this.unwrap<boolean>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/mobile_enabled`,
      ...options,
    })
  }

  /** Lists Superchargers and destination chargers near the vehicle. */
  async nearbyChargingSites(
    vin: string,
    options: RequestOverrides = {},
  ): Promise<NearbyChargingSites> {
    return await this.unwrap<NearbyChargingSites>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/nearby_charging_sites`,
      ...options,
    })
  }

  /** Returns recent alerts raised by the vehicle. */
  async recentAlerts(vin: string, options: RequestOverrides = {}): Promise<VehicleAlert[]> {
    return await this.unwrap<VehicleAlert[]>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/recent_alerts`,
      ...options,
    })
  }

  /** Returns service status for the vehicle. */
  async serviceData(vin: string, options: RequestOverrides = {}): Promise<ServiceData> {
    return await this.unwrap<ServiceData>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/service_data`,
      ...options,
    })
  }

  /**
   * Returns specifications recorded at the time of sale.
   *
   * Billed at a fixed rate per successful result and accessible only with a
   * partner token, for any VIN without owner authorization.
   */
  async specs(vin: string, options: RequestOverrides = {}): Promise<VehicleSpecs> {
    return await this.unwrap<VehicleSpecs>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/specs`,
      ...options,
    })
  }

  /** Returns firmware release notes for the vehicle. */
  async releaseNotes(vin: string, options: RequestOverrides = {}): Promise<ReleaseNotes> {
    return await this.unwrap<ReleaseNotes>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/release_notes`,
      ...options,
    })
  }

  /**
   * Reports application-relevant state for up to a batch of VINs.
   *
   * The authoritative way to discover whether a vehicle requires Vehicle
   * Command Protocol signing and whether this application's virtual key is
   * paired, rather than inferring either from model year.
   *
   * @param vins - VINs to query.
   *
   * @example
   * ```ts
   * const status = await client.vehicles.fleetStatus([vin])
   * if (status.vehicle_info?.[vin]?.vehicle_command_protocol_required) {
   *   // Route commands through a Vehicle Command Proxy.
   * }
   * ```
   */
  async fleetStatus(vins: string[], options: RequestOverrides = {}): Promise<FleetStatus> {
    return await this.unwrap<FleetStatus>({
      method: 'POST',
      path: '/api/1/vehicles/fleet_status',
      body: { vins: vins.map(assertVin) },
      idempotent: true,
      ...options,
    })
  }

  /**
   * Returns the active share invites for a vehicle.
   *
   * Paginated with a maximum page size of 25.
   */
  async shareInvites(
    vin: string,
    options: PageOptions & RequestOverrides = {},
  ): Promise<ShareInvite[]> {
    const { page, perPage, ...overrides } = options
    return await this.unwrap<ShareInvite[]>({
      method: 'GET',
      path: `/api/1/vehicles/${assertVin(vin)}/invitations`,
      query: { page, per_page: perPage },
      ...overrides,
    })
  }

  /**
   * Creates a single-use share invite that expires after 24 hours.
   *
   * Grants driver-level app access, which excludes some owner-only features
   * such as Service and Roadside. Up to five drivers may be added at a time,
   * and the vehicle need not be online.
   *
   * Never retried automatically: each call mints a distinct invite link.
   */
  async createShareInvite(vin: string, options: RequestOverrides = {}): Promise<ShareInvite> {
    return await this.unwrap<ShareInvite>({
      method: 'POST',
      path: `/api/1/vehicles/${assertVin(vin)}/invitations`,
      ...options,
    })
  }

  /** Revokes a share invite, invalidating its link. */
  async revokeShareInvite(
    vin: string,
    invitationId: string,
    options: RequestOverrides = {},
  ): Promise<CommandResult> {
    return await this.unwrap<CommandResult>({
      method: 'POST',
      path: `/api/1/vehicles/${assertVin(vin)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
      idempotent: true,
      ...options,
    })
  }

  /**
   * Redeems a share invite, granting the authenticated account app access.
   *
   * @param code - Single-use code from the invite link.
   */
  async redeemShareInvite(code: string, options: RequestOverrides = {}): Promise<ShareInvite> {
    return await this.unwrap<ShareInvite>({
      method: 'POST',
      path: '/api/1/invitations/redeem',
      body: { code },
      idempotent: true,
      ...options,
    })
  }
}
