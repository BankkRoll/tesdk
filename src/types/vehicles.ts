/**
 * @file Vehicle domain types.
 *
 * Fields mirror the Fleet API payloads. Tesla adds fields without a version
 * bump and omits others depending on model, region, and firmware, so most
 * properties are optional and every state object carries an index signature
 * for forward compatibility.
 */

/** Connectivity state reported for a vehicle. */
export type VehicleState = 'online' | 'asleep' | 'offline' | 'waking' | (string & {})

/** Summary returned by the vehicle list and detail endpoints. */
export interface Vehicle {
  id: number
  vehicle_id: number
  vin: string
  /** User-assigned name, `null` when never set. */
  display_name: string | null
  state: VehicleState
  in_service: boolean
  /** Fleet API identifier used in place of `id` for newer integrations. */
  id_s: string
  calendar_enabled: boolean
  api_version: number
  /** Present only when the account has granted the relevant scope. */
  access_type?: string
  granular_access?: { hide_private: boolean }
  [key: string]: unknown
}

/** Charge state subtree of {@link VehicleData}. */
export interface ChargeState {
  battery_level: number
  /** Estimated range in the account's distance unit. */
  battery_range: number
  charging_state: 'Disconnected' | 'Charging' | 'Complete' | 'Stopped' | 'NoPower' | (string & {})
  charge_limit_soc: number
  charge_amps?: number
  charge_port_door_open?: boolean
  charger_power?: number
  minutes_to_full_charge?: number
  time_to_full_charge?: number
  [key: string]: unknown
}

/** Climate state subtree of {@link VehicleData}. */
export interface ClimateState {
  inside_temp: number | null
  outside_temp: number | null
  is_climate_on: boolean
  driver_temp_setting: number
  passenger_temp_setting: number
  is_preconditioning?: boolean
  seat_heater_left?: number
  seat_heater_right?: number
  [key: string]: unknown
}

/**
 * Drive state subtree of {@link VehicleData}.
 *
 * Location fields require the `vehicle_location` scope and are absent
 * otherwise.
 */
export interface DriveState {
  latitude?: number
  longitude?: number
  heading?: number
  speed: number | null
  shift_state: 'P' | 'R' | 'N' | 'D' | null | (string & {})
  power?: number
  timestamp?: number
  [key: string]: unknown
}

/** Full vehicle snapshot returned by the `vehicle_data` endpoint. */
export interface VehicleData extends Vehicle {
  charge_state?: ChargeState
  climate_state?: ClimateState
  drive_state?: DriveState
  vehicle_state?: Record<string, unknown>
  vehicle_config?: Record<string, unknown>
  gui_settings?: Record<string, unknown>
}

/**
 * Data subtrees selectable via the `endpoints` query parameter.
 *
 * Requesting only the needed subtrees reduces payload size and vehicle wake
 * time.
 */
export type VehicleDataEndpoint =
  | 'charge_state'
  | 'climate_state'
  | 'closures_state'
  | 'drive_state'
  | 'gui_settings'
  | 'location_data'
  | 'vehicle_config'
  | 'vehicle_state'
  | 'vehicle_data_combo'

/** Result envelope returned by every vehicle command. */
export interface CommandResult {
  /** Whether the vehicle accepted the command. Absent on some payloads. */
  result?: boolean
  /** Populated when `result` is `false`. */
  reason?: string
  [key: string]: unknown
}

/** Options for {@link VehiclesResource.list}. */
export interface ListVehiclesOptions {
  /** 1-based page number. */
  page?: number
  /** Items per page. Fleet API defaults to 100. */
  perPage?: number
}

/** A driver permitted to access a vehicle. */
export interface Driver {
  my_tesla_unique_id?: number
  user_id?: number
  user_id_s?: string
  driver_first_name?: string
  driver_last_name?: string
  [key: string]: unknown
}

/** A charging site near the vehicle. */
export interface ChargingSite {
  name?: string
  type?: string
  distance_miles?: number
  location?: { lat: number; long: number }
  available_stalls?: number
  total_stalls?: number
  site_closed?: boolean
  [key: string]: unknown
}

/** Superchargers and destination chargers near the vehicle. */
export interface NearbyChargingSites {
  congestion_sync_time_utc_secs?: number
  destination_charging?: ChargingSite[]
  superchargers?: ChargingSite[]
  timestamp?: number
  [key: string]: unknown
}

/** An alert raised by the vehicle. */
export interface VehicleAlert {
  name?: string
  time?: string
  audience?: string[]
  /** Present when the alert relates to a user action. */
  user_text?: string
  [key: string]: unknown
}

/** Service status for a vehicle. */
export interface ServiceData {
  service_status?: string
  service_etc?: string
  service_visit_number?: string
  status_id?: number
  [key: string]: unknown
}

/** Specifications recorded at the time of sale. */
export interface VehicleSpecs {
  vin?: string
  model?: string
  trim?: string
  year?: number
  [key: string]: unknown
}

/** Firmware release notes for the installed or pending version. */
export interface ReleaseNotes {
  release_notes?: { title?: string; subtitle?: string; description?: string }[]
  version?: string
  [key: string]: unknown
}

/** A share invite granting driver-level app access. */
export interface ShareInvite {
  id?: string
  /** Single-use link that expires 24 hours after creation. */
  share_link?: string
  owner_id?: number
  vehicle_id?: number
  expires_at?: string
  revoked_at?: string | null
  [key: string]: unknown
}
