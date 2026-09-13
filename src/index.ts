/**
 * @file Public entry point for `tesdk`.
 *
 * Exports the client, resource classes, error hierarchy, auth helpers, and
 * every public type. Nothing outside this module is part of the supported
 * surface; deep imports into `dist` are unsupported and may break in a patch.
 *
 * @packageDocumentation
 */

export { TeslaClient, VERSION, type TeslaClientOptions } from './client.js'

export {
  AuthenticationError,
  ConnectionError,
  InvalidRequestError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  ServerError,
  SigningRequiredError,
  TeslaError,
  TimeoutError,
  VehicleAsleepError,
  type TeslaErrorCode,
  type TeslaErrorOptions,
} from './core/errors.js'

export {
  AUTHORIZE_URLS,
  OIDC_DISCOVERY_URL,
  REGION_BASE_URLS,
  TOKEN_URLS,
  regionForCountry,
  resolveBaseUrl,
  type Region,
} from './core/regions.js'

export type { FetchLike, RequestLogEntry, RequestOptions, RetryOptions } from './core/http.js'

export { OAuthClient, type AuthorizeUrlOptions, type ExchangeCodeOptions } from './auth/oauth.js'
export { createPkcePair, randomString, type PkcePair } from './auth/pkce.js'
export { MemoryTokenStore, createTokenStore } from './auth/store.js'
export {
  PUBLIC_KEY_PATH,
  publicKeyUrl,
  virtualKeyPairingUrl,
  type PairingUrlOptions,
} from './auth/virtual-key.js'
export type { OAuthClientConfig, Scope, TokenSet, TokenStore } from './auth/types.js'

export {
  CommandsResource,
  SeatPosition,
  type SendCommandOptions,
  type SetTempsOptions,
} from './resources/commands.js'
export {
  EnergyResource,
  type EnergyCommandResult,
  type EnergyHistory,
  type EnergySiteInfo,
  type EnergySiteLiveStatus,
  type HistoryEntry,
  type HistoryPeriod,
  type HistoryRangeOptions,
  type Product,
  type SiteOperationMode,
} from './resources/energy.js'
export {
  OcpiResource,
  type Connector,
  type Credentials,
  type Evse,
  type GeoLocation,
  type Location,
  type OcpiPageOptions,
  type OcpiResponse,
  type PriceComponent,
  type Tariff,
  type TariffElement,
  type TariffRestrictions,
  type VersionDetails,
  type VersionEndpoint,
} from './resources/ocpi.js'
export {
  TelemetryResource,
  type TelemetryConfig,
  type TelemetryConfigResult,
  type TelemetryConfigStatus,
  type TelemetryFieldConfig,
} from './resources/telemetry.js'
export {
  ChargingResource,
  type ChargingHistoryEntry,
  type ChargingHistoryPage,
  type ChargingSession,
  type ChargingSessionPage,
} from './resources/charging.js'
export {
  FleetResource,
  type Eligibility,
  type EnterpriseRoles,
  type PricingRequest,
  type VehicleOptions,
  type WarrantyDetails,
} from './resources/fleet.js'
export {
  PartnerResource,
  type FleetTelemetryError,
  type PartnerAccount,
  type PartnerPublicKey,
} from './resources/partner.js'
export { UserResource, type Order, type UserProfile, type UserRegion } from './resources/user.js'
export {
  VehiclesResource,
  type EnsureAwakeOptions,
  type FleetStatus,
  type VehicleDataOptions,
  type VehicleFleetInfo,
} from './resources/vehicles.js'

export type { FleetResponse, PageOptions, Pagination, RequestOverrides } from './types/common.js'
export type {
  ChargeState,
  ChargingSite,
  ClimateState,
  CommandResult,
  DriveState,
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
  VehicleState,
} from './types/vehicles.js'
