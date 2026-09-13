# Types

> 77 interfaces and 9 type aliases exported from `@bankkroll/tesdk`.

## Type aliases

### `FetchLike`

```ts
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>
```

Minimal `fetch` signature accepted by the client, allowing a custom
implementation to be injected for testing or for runtime-specific agents.

### `Region`

```ts
type Region = 'na' | 'eu' | 'cn'
```

### `Scope`

```ts
type Scope = /** Allows customers to sign in with their Tesla credentials. */
```

OAuth scopes accepted by Fleet API.

`openid` and `offline_access` are required to receive an id token and a
refresh token respectively.

### `VehicleState`

```ts
type VehicleState = 'online' | 'asleep' | 'offline' | 'waking' | (string & {})
```

### `VehicleDataEndpoint`

```ts
type VehicleDataEndpoint = 'charge_state' | 'climate_state' | 'closures_state' | 'drive_state' | 'gui_settings' | 'location_data' | 'vehicle_config' | 'vehicle_state' | 'vehicle_data_combo'
```

Data subtrees selectable via the `endpoints` query parameter.

Requesting only the needed subtrees reduces payload size and vehicle wake
time.

### `SeatPosition`

```ts
type SeatPosition = (typeof SeatPosition)[keyof typeof SeatPosition]
```

### `SiteOperationMode`

```ts
type SiteOperationMode = 'autonomous' | 'self_consumption' | 'backup'
```

### `HistoryPeriod`

```ts
type HistoryPeriod = 'day' | 'week' | 'month' | 'year' | 'lifetime'
```

### `TeslaErrorCode`

```ts
type TeslaErrorCode = 'api_error' | 'authentication_error' | 'permission_error' | 'not_found' | 'invalid_request' | 'rate_limit' | 'vehicle_asleep' | 'server_error' | 'connection_error' | 'timeout' | 'signing_required'
```

Stable discriminant for TeslaError.code.

Values are part of the public API and will not change within a major version.

## Interfaces

### `RetryOptions`

| Field | Type | Description |
| --- | --- | --- |
| `maxRetries?` | `number` |  |
| `initialDelayMs?` | `number` |  |
| `maxDelayMs?` | `number` |  |

### `RequestOptions`

| Field | Type | Description |
| --- | --- | --- |
| `method` | `'GET' \| 'POST' \| 'DELETE' \| 'PATCH' \| 'PUT'` |  |
| `path` | `string` |  |
| `query?` | `Record<string, string \| number \| boolean \| undefined \| null>` |  |
| `body?` | `unknown` |  |
| `timeoutMs?` | `number` |  |
| `signal?` | `AbortSignal` |  |
| `headers?` | `Record<string, string>` |  |
| `retry?` | `RetryOptions` |  |
| `responseType?` | `'json' \| 'binary'` | How to decode the response body. `json` parses JSON and falls back to text for other content types. `binary` returns an `ArrayBuffer` unchanged, which is required for endpoints such as PDF invoices where text decoding would corrupt bytes. |
| `idempotent?` | `boolean` | Whether the request may be retried. Defaults to `true` for `GET`. Non-idempotent commands such as `honk_horn` set this to `false` so a retry cannot trigger a duplicate physical action. |

### `HttpClientConfig`

| Field | Type | Description |
| --- | --- | --- |
| `baseUrl` | `string` |  |
| `fetch` | `FetchLike` |  |
| `timeoutMs` | `number` |  |
| `retry` | `Required<RetryOptions>` |  |
| `userAgent` | `string` |  |
| `defaultHeaders?` | `Record<string, string>` |  |
| `getAuthHeader?` | `() => Promise<string \| undefined>` | Supplies the `Authorization` header value, refreshing the access token when required. Omit for unauthenticated clients. |
| `onRequest?` | `(info: RequestLogEntry) => void` |  |

### `RequestLogEntry`

| Field | Type | Description |
| --- | --- | --- |
| `method` | `string` |  |
| `url` | `string` |  |
| `attempt` | `number` |  |
| `status?` | `number` |  |
| `durationMs` | `number` |  |
| `error?` | `unknown` |  |

### `PkcePair`

| Field | Type | Description |
| --- | --- | --- |
| `verifier` | `string` |  |
| `challenge` | `string` |  |
| `method` | `'S256'` |  |

### `TokenSet`

| Field | Type | Description |
| --- | --- | --- |
| `accessToken` | `string` |  |
| `refreshToken?` | `string` |  |
| `expiresAt` | `number` |  |
| `scopes?` | `string[]` |  |
| `idToken?` | `string` |  |
| `tokenType?` | `string` |  |

### `TokenStore`

Persistence adapter for tokens.

Implementations may be synchronous or asynchronous, allowing an in-memory
map, `localStorage`, a KV namespace, or a database row to be used
interchangeably.

### `OAuthClientConfig`

| Field | Type | Description |
| --- | --- | --- |
| `clientId` | `string` |  |
| `clientSecret?` | `string` | Application secret. Omit for public clients using PKCE, such as browser and mobile applications, where a secret cannot be kept confidential. |
| `redirectUri?` | `string` |  |
| `region?` | `Region` |  |

### `AuthorizeUrlOptions`

| Field | Type | Description |
| --- | --- | --- |
| `scopes` | `Scope[]` |  |
| `state` | `string` |  |
| `pkce?` | `PkcePair` |  |
| `redirectUri?` | `string` |  |
| `prompt?` | `'login' \| 'consent'` |  |
| `nonce?` | `string` |  |

### `ExchangeCodeOptions`

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` |  |
| `codeVerifier?` | `string` |  |
| `redirectUri?` | `string` |  |

### `FleetResponse`

Envelope wrapping every Fleet API payload.

The SDK unwraps this before returning, so `response` is not visible on
resource method return types.

| Field | Type | Description |
| --- | --- | --- |
| `response` | `T` |  |
| `pagination?` | `Pagination` |  |
| `error?` | `string` |  |
| `error_description?` | `string` |  |

### `Pagination`

| Field | Type | Description |
| --- | --- | --- |
| `previous` | `number \| null` |  |
| `next` | `number \| null` |  |
| `current` | `number` |  |
| `per_page` | `number` |  |
| `count` | `number` |  |
| `pages` | `number` |  |

### `PageOptions`

| Field | Type | Description |
| --- | --- | --- |
| `page?` | `number` |  |
| `perPage?` | `number` |  |

### `RequestOverrides`

| Field | Type | Description |
| --- | --- | --- |
| `signal?` | `AbortSignal` |  |
| `timeoutMs?` | `number` |  |

### `Vehicle`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `number` |  |
| `vehicle_id` | `number` |  |
| `vin` | `string` |  |
| `display_name` | `string \| null` |  |
| `state` | `VehicleState` |  |
| `in_service` | `boolean` |  |
| `id_s` | `string` |  |
| `calendar_enabled` | `boolean` |  |
| `api_version` | `number` |  |
| `access_type?` | `string` |  |
| `granular_access?` | `{` |  |

### `ChargeState`

| Field | Type | Description |
| --- | --- | --- |
| `battery_level` | `number` |  |
| `battery_range` | `number` |  |
| `charging_state` | `'Disconnected' \| 'Charging' \| 'Complete' \| 'Stopped' \| 'NoPower' \| (string & {})` |  |
| `charge_limit_soc` | `number` |  |
| `charge_amps?` | `number` |  |
| `charge_port_door_open?` | `boolean` |  |
| `charger_power?` | `number` |  |
| `minutes_to_full_charge?` | `number` |  |
| `time_to_full_charge?` | `number` |  |

### `ClimateState`

| Field | Type | Description |
| --- | --- | --- |
| `inside_temp` | `number \| null` |  |
| `outside_temp` | `number \| null` |  |
| `is_climate_on` | `boolean` |  |
| `driver_temp_setting` | `number` |  |
| `passenger_temp_setting` | `number` |  |
| `is_preconditioning?` | `boolean` |  |
| `seat_heater_left?` | `number` |  |
| `seat_heater_right?` | `number` |  |

### `DriveState`

Drive state subtree of VehicleData.

Location fields require the `vehicle_location` scope and are absent
otherwise.

| Field | Type | Description |
| --- | --- | --- |
| `latitude?` | `number` |  |
| `longitude?` | `number` |  |
| `heading?` | `number` |  |
| `speed` | `number \| null` |  |
| `shift_state` | `'P' \| 'R' \| 'N' \| 'D' \| null \| (string & {})` |  |
| `power?` | `number` |  |
| `timestamp?` | `number` |  |

### `VehicleData`

| Field | Type | Description |
| --- | --- | --- |
| `charge_state?` | `ChargeState` |  |
| `climate_state?` | `ClimateState` |  |
| `drive_state?` | `DriveState` |  |
| `vehicle_state?` | `Record<string, unknown>` |  |
| `vehicle_config?` | `Record<string, unknown>` |  |
| `gui_settings?` | `Record<string, unknown>` |  |

### `CommandResult`

| Field | Type | Description |
| --- | --- | --- |
| `result?` | `boolean` |  |
| `reason?` | `string` |  |

### `ListVehiclesOptions`

| Field | Type | Description |
| --- | --- | --- |
| `page?` | `number` |  |
| `perPage?` | `number` |  |

### `Driver`

| Field | Type | Description |
| --- | --- | --- |
| `my_tesla_unique_id?` | `number` |  |
| `user_id?` | `number` |  |
| `user_id_s?` | `string` |  |
| `driver_first_name?` | `string` |  |
| `driver_last_name?` | `string` |  |

### `ChargingSite`

| Field | Type | Description |
| --- | --- | --- |
| `name?` | `string` |  |
| `type?` | `string` |  |
| `distance_miles?` | `number` |  |
| `location?` | `{` |  |
| `available_stalls?` | `number` |  |
| `total_stalls?` | `number` |  |
| `site_closed?` | `boolean` |  |

### `NearbyChargingSites`

| Field | Type | Description |
| --- | --- | --- |
| `congestion_sync_time_utc_secs?` | `number` |  |
| `destination_charging?` | `ChargingSite[]` |  |
| `superchargers?` | `ChargingSite[]` |  |
| `timestamp?` | `number` |  |

### `VehicleAlert`

| Field | Type | Description |
| --- | --- | --- |
| `name?` | `string` |  |
| `time?` | `string` |  |
| `audience?` | `string[]` |  |
| `user_text?` | `string` |  |

### `ServiceData`

| Field | Type | Description |
| --- | --- | --- |
| `service_status?` | `string` |  |
| `service_etc?` | `string` |  |
| `service_visit_number?` | `string` |  |
| `status_id?` | `number` |  |

### `VehicleSpecs`

| Field | Type | Description |
| --- | --- | --- |
| `vin?` | `string` |  |
| `model?` | `string` |  |
| `trim?` | `string` |  |
| `year?` | `number` |  |

### `ReleaseNotes`

| Field | Type | Description |
| --- | --- | --- |
| `release_notes?` | `{` |  |
| `version?` | `string` |  |

### `ShareInvite`

| Field | Type | Description |
| --- | --- | --- |
| `id?` | `string` |  |
| `share_link?` | `string` |  |
| `owner_id?` | `number` |  |
| `vehicle_id?` | `number` |  |
| `expires_at?` | `string` |  |
| `revoked_at?` | `string \| null` |  |

### `SendCommandOptions`

| Field | Type | Description |
| --- | --- | --- |
| `idempotent?` | `boolean` | Whether the command may be retried after a transient failure. Left `false` for commands with a visible physical effect, where a retry could double-actuate. |
| `throwOnFailure?` | `boolean` | Throw a TeslaError when the vehicle returns `result: false`. |

### `SetTempsOptions`

| Field | Type | Description |
| --- | --- | --- |
| `driverTemp` | `number` |  |
| `passengerTemp?` | `number` |  |

### `HistoryRangeOptions`

| Field | Type | Description |
| --- | --- | --- |
| `startDate?` | `string` |  |
| `endDate?` | `string` |  |
| `timeZone?` | `string` |  |

### `EnergySiteLiveStatus`

| Field | Type | Description |
| --- | --- | --- |
| `solar_power?` | `number` |  |
| `grid_power?` | `number` |  |
| `battery_power?` | `number` |  |
| `load_power?` | `number` |  |
| `percentage_charged?` | `number` |  |
| `energy_left?` | `number` |  |
| `total_pack_energy?` | `number` |  |
| `grid_status?` | `string` |  |
| `storm_mode_active?` | `boolean` |  |
| `timestamp?` | `string` |  |

### `EnergySiteInfo`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` |  |
| `site_name?` | `string` |  |
| `backup_reserve_percent?` | `number` |  |
| `default_real_mode?` | `SiteOperationMode` |  |
| `installation_date?` | `string` |  |
| `version?` | `string` |  |

### `HistoryEntry`

| Field | Type | Description |
| --- | --- | --- |
| `timestamp?` | `string` |  |

### `EnergyHistory`

| Field | Type | Description |
| --- | --- | --- |
| `period?` | `string` |  |
| `time_series?` | `HistoryEntry[]` |  |
| `installation_time_zone?` | `string` |  |

### `EnergyCommandResult`

Acknowledgement returned by energy site setting endpoints.

Tesla returns varying shapes here depending on the setting, so only the
common fields are named.

| Field | Type | Description |
| --- | --- | --- |
| `code?` | `number` |  |
| `message?` | `string` |  |

### `Product`

| Field | Type | Description |
| --- | --- | --- |
| `energy_site_id?` | `number` |  |
| `vin?` | `string` |  |
| `resource_type?` | `string` |  |
| `site_name?` | `string` |  |
| `id?` | `number \| string` |  |

### `ChargingHistoryEntry`

| Field | Type | Description |
| --- | --- | --- |
| `sessionId?` | `number` |  |
| `vin?` | `string` |  |
| `chargeStartDateTime?` | `string` |  |
| `chargeStopDateTime?` | `string` |  |
| `siteLocationName?` | `string` |  |
| `energyDrawnKwh?` | `string` |  |
| `fees?` | `unknown[]` |  |

### `ChargingHistoryPage`

| Field | Type | Description |
| --- | --- | --- |
| `data?` | `ChargingHistoryEntry[]` |  |
| `totalResults?` | `number` |  |
| `hasMoreData?` | `boolean` |  |

### `ChargingSession`

| Field | Type | Description |
| --- | --- | --- |
| `sessionId?` | `string` |  |
| `vin?` | `string` |  |
| `energyDrawnKwh?` | `number` |  |
| `chargeStartDateTime?` | `string` |  |
| `chargeStopDateTime?` | `string` |  |

### `ChargingSessionPage`

| Field | Type | Description |
| --- | --- | --- |
| `data?` | `ChargingSession[]` |  |
| `totalResults?` | `number` |  |

### `VehicleOptions`

| Field | Type | Description |
| --- | --- | --- |
| `codes?` | `{` |  |

### `Eligibility`

| Field | Type | Description |
| --- | --- | --- |
| `eligible?` | `boolean` |  |
| `vin?` | `string` |  |

### `WarrantyDetails`

| Field | Type | Description |
| --- | --- | --- |
| `activeWarranty?` | `unknown[]` |  |
| `upcomingWarranty?` | `unknown[]` |  |
| `expiredWarranty?` | `unknown[]` |  |

### `PricingRequest`

| Field | Type | Description |
| --- | --- | --- |
| `market` | `string` |  |
| `model` | `string` |  |
| `currency?` | `string` |  |

### `EnterpriseRoles`

| Field | Type | Description |
| --- | --- | --- |
| `vin?` | `string` |  |
| `roles?` | `unknown[]` |  |

### `PartnerAccount`

| Field | Type | Description |
| --- | --- | --- |
| `account_id?` | `string` |  |
| `domain?` | `string` |  |
| `name?` | `string` |  |
| `description?` | `string` |  |
| `client_id?` | `string` |  |
| `ca?` | `string` |  |
| `created_at?` | `string` |  |
| `updated_at?` | `string` |  |

### `PartnerPublicKey`

| Field | Type | Description |
| --- | --- | --- |
| `public_key?` | `string` |  |

### `FleetTelemetryError`

| Field | Type | Description |
| --- | --- | --- |
| `vin?` | `string` |  |
| `name?` | `string` |  |
| `error?` | `string` |  |
| `timestamp?` | `string` |  |

### `UserProfile`

| Field | Type | Description |
| --- | --- | --- |
| `email?` | `string` |  |
| `full_name?` | `string` |  |
| `profile_image_url?` | `string` |  |
| `vault_uuid?` | `string` |  |

### `UserRegion`

| Field | Type | Description |
| --- | --- | --- |
| `region` | `string` |  |
| `fleet_api_base_url` | `string` |  |

### `Order`

| Field | Type | Description |
| --- | --- | --- |
| `orderId?` | `string` |  |
| `vin?` | `string` |  |
| `modelCode?` | `string` |  |
| `orderStatus?` | `string` |  |

### `GeoLocation`

| Field | Type | Description |
| --- | --- | --- |
| `latitude` | `string` |  |
| `longitude` | `string` |  |

### `Connector`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` |  |
| `standard` | `string` |  |
| `format` | `'SOCKET' \| 'CABLE' \| (string & {})` |  |
| `power_type` | `'AC_1_PHASE' \| 'AC_3_PHASE' \| 'DC' \| (string & {})` |  |
| `max_voltage?` | `number` |  |
| `max_amperage?` | `number` |  |
| `max_electric_power?` | `number` |  |
| `tariff_ids?` | `string[]` |  |
| `last_updated?` | `string` |  |

### `Evse`

| Field | Type | Description |
| --- | --- | --- |
| `uid` | `string` |  |
| `evse_id?` | `string` |  |
| `status` | `'AVAILABLE' \| 'CHARGING' \| 'OUTOFORDER' \| 'INOPERATIVE' \| 'PLANNED' \| (string & {})` |  |
| `connectors` | `Connector[]` |  |
| `capabilities?` | `string[]` |  |
| `physical_reference?` | `string` |  |
| `last_updated?` | `string` |  |

### `Location`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` |  |
| `name?` | `string` |  |
| `address` | `string` |  |
| `city` | `string` |  |
| `state?` | `string` |  |
| `postal_code?` | `string` |  |
| `country` | `string` |  |
| `coordinates` | `GeoLocation` |  |
| `evses?` | `Evse[]` |  |
| `evse_count?` | `number` |  |
| `access_type?` | `string` |  |
| `operator?` | `{` |  |
| `party_id?` | `string` |  |
| `country_code?` | `string` |  |
| `opening_times?` | `Record<string, unknown>` |  |
| `time_zone?` | `string` |  |
| `last_updated?` | `string` |  |

### `PriceComponent`

| Field | Type | Description |
| --- | --- | --- |
| `type` | `'ENERGY' \| 'FLAT' \| 'PARKING_TIME' \| 'TIME' \| 'CONGESTION_TIME' \| (string & {})` | Dimension being charged. Tesla extends OCPI with `CONGESTION_TIME`, which bills time spent charging past a state-of-charge threshold. |
| `price` | `number` |  |
| `vat?` | `number` |  |
| `step_size` | `number` |  |

### `TariffRestrictions`

| Field | Type | Description |
| --- | --- | --- |
| `start_time?` | `string` |  |
| `end_time?` | `string` |  |
| `min_kwh?` | `number` |  |
| `max_kwh?` | `number` |  |
| `min_power?` | `number` |  |
| `max_power?` | `number` |  |
| `day_of_week?` | `string[]` |  |
| `min_vehicle_soc?` | `number` |  |
| `min_congestion_threshold?` | `number` |  |

### `TariffElement`

| Field | Type | Description |
| --- | --- | --- |
| `price_components` | `PriceComponent[]` |  |
| `restrictions?` | `TariffRestrictions` |  |

### `Tariff`

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` |  |
| `currency` | `string` |  |
| `country_code?` | `string` |  |
| `party_id?` | `string` |  |
| `elements` | `TariffElement[]` |  |
| `start_date_time?` | `string` |  |
| `end_date_time?` | `string` |  |
| `last_updated?` | `string` |  |

### `VersionEndpoint`

| Field | Type | Description |
| --- | --- | --- |
| `identifier` | `string` |  |
| `role?` | `string` |  |
| `url` | `string` |  |

### `VersionDetails`

| Field | Type | Description |
| --- | --- | --- |
| `version` | `string` |  |
| `endpoints` | `VersionEndpoint[]` |  |

### `Credentials`

| Field | Type | Description |
| --- | --- | --- |
| `token` | `string` |  |
| `url` | `string` |  |
| `roles?` | `{` |  |

### `OcpiResponse`

| Field | Type | Description |
| --- | --- | --- |
| `data` | `T` |  |
| `status_code` | `number` |  |
| `status_message?` | `string` |  |
| `timestamp?` | `string` |  |

### `OcpiPageOptions`

| Field | Type | Description |
| --- | --- | --- |
| `offset?` | `number` |  |
| `limit?` | `number` |  |
| `dateFrom?` | `string` |  |
| `dateTo?` | `string` |  |

### `TelemetryFieldConfig`

Per-field streaming rules.

A value is sent only once `interval_seconds` has elapsed since its last
emission and the value has actually changed, so a short interval does not by
itself increase traffic for a stable signal.

| Field | Type | Description |
| --- | --- | --- |
| `interval_seconds` | `number` |  |
| `minimum_delta?` | `number` | Minimum change required before the field is re-sent. Location deltas are measured in meters. Requires firmware 2025.2.6 or later. |
| `include_fields?` | `string[]` | Fields to include in the same payload whenever this field publishes, even if their own value has not changed. Requires Fleet Telemetry client 1.3.0. |

### `TelemetryConfig`

| Field | Type | Description |
| --- | --- | --- |
| `hostname` | `string` |  |
| `ca` | `string` |  |
| `fields` | `Record<string, TelemetryFieldConfig>` |  |
| `exp?` | `number` |  |
| `port?` | `number` |  |
| `delivery_policy?` | `'latest'` | Set to `latest` to have the vehicle resend data the server has not acknowledged. Requires Fleet Telemetry server 0.7.1 or later. |

### `TelemetryConfigResult`

| Field | Type | Description |
| --- | --- | --- |
| `updated_vehicles?` | `number` |  |
| `skipped_vehicles?` | `Record<string, unknown>` |  |

### `TelemetryConfigStatus`

| Field | Type | Description |
| --- | --- | --- |
| `synced?` | `boolean` |  |
| `config?` | `TelemetryConfig` |  |
| `limit_reached?` | `boolean` |  |

### `VehicleDataOptions`

| Field | Type | Description |
| --- | --- | --- |
| `endpoints?` | `VehicleDataEndpoint[]` | Subtrees to fetch. Requesting only what is needed reduces payload size and shortens how long the vehicle stays awake. |

### `EnsureAwakeOptions`

| Field | Type | Description |
| --- | --- | --- |
| `maxWaitMs?` | `number` |  |
| `pollIntervalMs?` | `number` |  |

### `FleetStatus`

| Field | Type | Description |
| --- | --- | --- |
| `key_paired_vins?` | `string[]` |  |
| `unpaired_vins?` | `string[]` |  |
| `vehicle_info?` | `Record<string, VehicleFleetInfo>` |  |

### `VehicleFleetInfo`

| Field | Type | Description |
| --- | --- | --- |
| `vehicle_command_protocol_required?` | `boolean` | Whether the vehicle rejects unsigned commands. When `true`, route commands through a Vehicle Command Proxy. |
| `firmware_version?` | `string` |  |
| `fleet_telemetry_version?` | `string` |  |
| `total_number_of_keys?` | `number` |  |
| `discounted_device_data?` | `boolean` |  |
| `safety_screen_streaming_toggle_enabled?` | `boolean` |  |

### `TeslaClientOptions`

Configuration for TeslaClient.

Optional properties accept an explicit `undefined` so that values read
straight from `process.env` can be passed without narrowing.

| Field | Type | Description |
| --- | --- | --- |
| `region?` | `Region \| undefined` | Region to route requests to. A token minted for one region is rejected by the others. |
| `baseUrl?` | `string \| undefined` | Overrides the base URL derived from `region`. Set this to the address of a Vehicle Command Proxy so that commands are signed, or to a mock server in tests. |
| `accessToken?` | `string \| undefined` | A static access token. Convenient for scripts. Provide `tokens` or a `tokenStore` instead when the client should refresh credentials on its own. |
| `tokens?` | `TokenSet \| undefined` |  |
| `tokenStore?` | `TokenStore \| undefined` | Persistence for tokens. Required for automatic refresh across restarts. |
| `ocpiToken?` | `string \| undefined` | OCPI credentials token for the Tesla Charging API. The Charging API is a separate product from the Fleet API charging endpoints under `client.charging`: it exposes Tesla's public network as a CPO and authenticates with OCPI's `Token` scheme rather than OAuth. Setting this affects only the `ocpi` namespace, which is given its own transport. Fleet API calls on the same client continue to use the OAuth session, so one instance can serve both products. |
| `ocpiBaseUrl?` | `string \| undefined` | Base URL for the Charging API, supplied by Tesla during the OCPI credentials handshake. Defaults to `baseUrl`, then to the region host. Set it whenever the Charging API is served from a different origin than Fleet API. |
| `clientId?` | `string \| undefined` |  |
| `clientSecret?` | `string \| undefined` |  |
| `redirectUri?` | `string \| undefined` |  |
| `timeoutMs?` | `number \| undefined` | Request timeout in milliseconds. |
| `retry?` | `RetryOptions \| undefined` |  |
| `fetch?` | `FetchLike \| undefined` | `fetch` implementation to use. |
| `headers?` | `Record<string, string> \| undefined` |  |
| `userAgent?` | `string \| undefined` | Value sent as `User-Agent` off-browser. |
| `onRequest?` | `((info: RequestLogEntry) => void) \| undefined` |  |

### `TeslaErrorOptions`

| Field | Type | Description |
| --- | --- | --- |
| `status?` | `number` |  |
| `body?` | `unknown` |  |
| `requestId?` | `string` |  |
| `cause?` | `unknown` |  |

### `PairingUrlOptions`

| Field | Type | Description |
| --- | --- | --- |
| `domain` | `string` |  |
| `vin?` | `string` |  |

