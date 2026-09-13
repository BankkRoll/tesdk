/**
 * @file Energy product endpoints for Powerwall, Solar, and Wall Connector sites.
 */

import type { RequestOverrides } from '../types/common.js'
import { BaseResource } from './base.js'

/** Operating mode of an energy site. */
export type SiteOperationMode = 'autonomous' | 'self_consumption' | 'backup'

/** Aggregation period accepted by the history endpoints. */
export type HistoryPeriod = 'day' | 'week' | 'month' | 'year' | 'lifetime'

/** Date range and time zone accepted by the history endpoints. */
export interface HistoryRangeOptions extends RequestOverrides {
  /** ISO 8601 start of the range. */
  startDate?: string
  /** ISO 8601 end of the range. */
  endDate?: string
  /** IANA time zone used to align period boundaries, such as `America/Los_Angeles`. */
  timeZone?: string
}

/** Live telemetry returned by {@link EnergyResource.liveStatus}. */
export interface EnergySiteLiveStatus {
  solar_power?: number
  /** Positive when importing from the grid, negative when exporting. */
  grid_power?: number
  battery_power?: number
  load_power?: number
  /** Battery state of charge as a percentage. */
  percentage_charged?: number
  energy_left?: number
  total_pack_energy?: number
  grid_status?: string
  storm_mode_active?: boolean
  timestamp?: string
  [key: string]: unknown
}

/** Site configuration returned by {@link EnergyResource.siteInfo}. */
export interface EnergySiteInfo {
  id: string
  site_name?: string
  backup_reserve_percent?: number
  default_real_mode?: SiteOperationMode
  installation_date?: string
  version?: string
  [key: string]: unknown
}

/** A single bucket in a history series. */
export interface HistoryEntry {
  timestamp?: string
  /** Energy values are in watt-hours; power values are in watts. */
  [key: string]: unknown
}

/** Aggregated time series returned by the history endpoints. */
export interface EnergyHistory {
  period?: string
  time_series?: HistoryEntry[]
  installation_time_zone?: string
  [key: string]: unknown
}

/**
 * Acknowledgement returned by energy site setting endpoints.
 *
 * Tesla returns varying shapes here depending on the setting, so only the
 * common fields are named.
 */
export interface EnergyCommandResult {
  code?: number
  message?: string
  [key: string]: unknown
}

/** An energy or vehicle product attached to the account. */
export interface Product {
  /** Present on energy products. */
  energy_site_id?: number
  /** Present on vehicle products. */
  vin?: string
  resource_type?: string
  site_name?: string
  id?: number | string
  [key: string]: unknown
}

/**
 * Energy site data and control.
 *
 * Accessed as `client.energy`.
 */
export class EnergyResource extends BaseResource {
  /**
   * Lists every product on the account, including vehicles and energy sites.
   *
   * @example
   * ```ts
   * const sites = (await client.energy.products()).filter((p) => p.energy_site_id)
   * ```
   */
  async products(options: RequestOverrides = {}): Promise<Product[]> {
    return await this.unwrap<Product[]>({ method: 'GET', path: '/api/1/products', ...options })
  }

  /** Returns real-time power flow and battery state for a site. */
  async liveStatus(
    siteId: number | string,
    options: RequestOverrides = {},
  ): Promise<EnergySiteLiveStatus> {
    return await this.unwrap<EnergySiteLiveStatus>({
      method: 'GET',
      path: `/api/1/energy_sites/${siteId}/live_status`,
      ...options,
    })
  }

  /** Returns the site's hardware configuration and settings. */
  async siteInfo(siteId: number | string, options: RequestOverrides = {}): Promise<EnergySiteInfo> {
    return await this.unwrap<EnergySiteInfo>({
      method: 'GET',
      path: `/api/1/energy_sites/${siteId}/site_info`,
      ...options,
    })
  }

  /**
   * Returns site energy measurements aggregated to the requested period.
   *
   * Energy values are in watt-hours.
   */
  async energyHistory(
    siteId: number | string,
    period: HistoryPeriod,
    options: HistoryRangeOptions = {},
  ): Promise<EnergyHistory> {
    const { startDate, endDate, timeZone, ...overrides } = options
    return await this.unwrap<EnergyHistory>({
      method: 'GET',
      path: `/api/1/energy_sites/${siteId}/calendar_history`,
      query: {
        kind: 'energy',
        period,
        start_date: startDate,
        end_date: endDate,
        time_zone: timeZone,
      },
      ...overrides,
    })
  }

  /** Returns the history of grid outage events, with durations in seconds. */
  async backupHistory(
    siteId: number | string,
    period: HistoryPeriod,
    options: HistoryRangeOptions = {},
  ): Promise<EnergyHistory> {
    const { startDate, endDate, timeZone, ...overrides } = options
    return await this.unwrap<EnergyHistory>({
      method: 'GET',
      path: `/api/1/energy_sites/${siteId}/calendar_history`,
      query: {
        kind: 'backup',
        period,
        start_date: startDate,
        end_date: endDate,
        time_zone: timeZone,
      },
      ...overrides,
    })
  }

  /**
   * Returns Wall Connector charging history.
   *
   * Energy values are in watt-hours. This endpoint takes no `period`.
   */
  async chargeHistory(
    siteId: number | string,
    options: Omit<HistoryRangeOptions, 'period'> = {},
  ): Promise<EnergyHistory> {
    const { startDate, endDate, timeZone, ...overrides } = options
    return await this.unwrap<EnergyHistory>({
      method: 'GET',
      path: `/api/1/energy_sites/${siteId}/telemetry_history`,
      query: { kind: 'charge', start_date: startDate, end_date: endDate, time_zone: timeZone },
      ...overrides,
    })
  }

  /**
   * Sets the reserve held back for grid outages.
   *
   * @param percent - Reserve level from 0 to 100.
   */
  async setBackupReserve(
    siteId: number | string,
    percent: number,
    options: RequestOverrides = {},
  ): Promise<EnergyCommandResult> {
    return await this.unwrap<EnergyCommandResult>({
      method: 'POST',
      path: `/api/1/energy_sites/${siteId}/backup`,
      body: { backup_reserve_percent: percent },
      idempotent: true,
      ...options,
    })
  }

  /** Sets the site operating mode. */
  async setOperationMode(
    siteId: number | string,
    mode: SiteOperationMode,
    options: RequestOverrides = {},
  ): Promise<EnergyCommandResult> {
    return await this.unwrap<EnergyCommandResult>({
      method: 'POST',
      path: `/api/1/energy_sites/${siteId}/operation`,
      body: { default_real_mode: mode },
      idempotent: true,
      ...options,
    })
  }

  /** Enables or disables Storm Watch. */
  async setStormMode(
    siteId: number | string,
    enabled: boolean,
    options: RequestOverrides = {},
  ): Promise<EnergyCommandResult> {
    return await this.unwrap<EnergyCommandResult>({
      method: 'POST',
      path: `/api/1/energy_sites/${siteId}/storm_mode`,
      body: { enabled },
      idempotent: true,
      ...options,
    })
  }

  /** Configures grid charging and energy export permissions. */
  async setGridImportExport(
    siteId: number | string,
    settings: {
      disallow_charge_from_grid_with_solar_installed?: boolean
      customer_preferred_export_rule?: 'battery_ok' | 'pv_only' | 'never'
    },
    options: RequestOverrides = {},
  ): Promise<EnergyCommandResult> {
    return await this.unwrap<EnergyCommandResult>({
      method: 'POST',
      path: `/api/1/energy_sites/${siteId}/grid_import_export`,
      body: settings,
      idempotent: true,
      ...options,
    })
  }

  /** Sets the reserve available for vehicle charging during an outage. */
  async setOffGridVehicleChargingReserve(
    siteId: number | string,
    percent: number,
    options: RequestOverrides = {},
  ): Promise<EnergyCommandResult> {
    return await this.unwrap<EnergyCommandResult>({
      method: 'POST',
      path: `/api/1/energy_sites/${siteId}/off_grid_vehicle_charging_reserve`,
      body: { off_grid_vehicle_charging_reserve_percent: percent },
      idempotent: true,
      ...options,
    })
  }

  /**
   * Configures the utility rate plan used for time-of-use optimization.
   *
   * The tariff must define at least one season, cover every time period
   * without gaps or overlaps, and use non-negative prices. Tesla publishes a
   * worked example alongside the endpoint documentation.
   *
   * @param tariff - Tariff structure sent as `tou_settings.tariff_content_v2`.
   *
   * @see {@link https://developer.tesla.com/docs/fleet-api/endpoints/energy}
   */
  async setTimeOfUseSettings(
    siteId: number | string,
    tariff: Record<string, unknown>,
    options: RequestOverrides = {},
  ): Promise<EnergyCommandResult> {
    return await this.unwrap<EnergyCommandResult>({
      method: 'POST',
      path: `/api/1/energy_sites/${siteId}/time_of_use_settings`,
      body: { tou_settings: { tariff_content_v2: tariff } },
      idempotent: true,
      ...options,
    })
  }
}
