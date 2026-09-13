/**
 * @file Regional routing for the Fleet API.
 *
 * Fleet API is partitioned into three isolated regions. A token minted for one
 * region's `audience` is rejected by the others, so region selection affects
 * correctness rather than latency.
 */

/** Fleet API region identifier. */
export type Region = 'na' | 'eu' | 'cn'

/**
 * Base URL per region. The same value is used as the OAuth `audience`
 * parameter when minting tokens.
 */
export const REGION_BASE_URLS = {
  na: 'https://fleet-api.prd.na.vn.cloud.tesla.com',
  eu: 'https://fleet-api.prd.eu.vn.cloud.tesla.com',
  cn: 'https://fleet-api.prd.cn.vn.cloud.tesla.cn',
} as const satisfies Record<Region, string>

/** OAuth token endpoint per region. */
export const TOKEN_URLS = {
  na: 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token',
  eu: 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token',
  cn: 'https://auth.tesla.cn/oauth2/v3/token',
} as const satisfies Record<Region, string>

/**
 * OpenID Connect discovery document for third-party applications.
 *
 * Useful for verifying signing keys and confirming endpoint URLs at runtime.
 */
export const OIDC_DISCOVERY_URL =
  'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/thirdparty/.well-known/openid-configuration'

/** OAuth authorization endpoint per region, used to build consent URLs. */
export const AUTHORIZE_URLS = {
  na: 'https://auth.tesla.com/oauth2/v3/authorize',
  eu: 'https://auth.tesla.com/oauth2/v3/authorize',
  cn: 'https://auth.tesla.cn/oauth2/v3/authorize',
} as const satisfies Record<Region, string>

/**
 * ISO 3166-1 alpha-2 country code to region. Asia-Pacific markets are served
 * by the `na` cluster; mainland China is the only separate deployment.
 */
const COUNTRY_REGIONS: Record<string, Region> = {
  US: 'na',
  CA: 'na',
  MX: 'na',
  PR: 'na',
  JP: 'na',
  KR: 'na',
  AU: 'na',
  TW: 'na',
  NZ: 'na',
  HK: 'na',
  MO: 'na',
  MY: 'na',
  TH: 'na',
  PH: 'na',
  GB: 'eu',
  NO: 'eu',
  NL: 'eu',
  DE: 'eu',
  IE: 'eu',
  FR: 'eu',
  DK: 'eu',
  SE: 'eu',
  BE: 'eu',
  SK: 'eu',
  GR: 'eu',
  AT: 'eu',
  BG: 'eu',
  HR: 'eu',
  CH: 'eu',
  CY: 'eu',
  CZ: 'eu',
  EE: 'eu',
  FI: 'eu',
  HU: 'eu',
  IT: 'eu',
  LV: 'eu',
  LT: 'eu',
  LU: 'eu',
  MT: 'eu',
  PL: 'eu',
  PT: 'eu',
  RO: 'eu',
  SI: 'eu',
  ES: 'eu',
  CN: 'cn',
}

/**
 * Resolves a country code to the region serving it.
 *
 * @param countryCode - ISO 3166-1 alpha-2 code, case-insensitive.
 * @returns The region, or `undefined` when the country is unsupported.
 *
 * @example
 * ```ts
 * regionForCountry('DE') // 'eu'
 * regionForCountry('JP') // 'na'
 * ```
 */
export function regionForCountry(countryCode: string): Region | undefined {
  return COUNTRY_REGIONS[countryCode.toUpperCase()]
}

/**
 * Normalizes a region key or explicit base URL into a URL without a trailing
 * slash.
 *
 * @param region - A known region key, or a full base URL such as the address
 * of a self-hosted Vehicle Command Proxy.
 *
 * @example
 * ```ts
 * resolveBaseUrl('eu')                      // 'https://fleet-api.prd.eu.vn.cloud.tesla.com'
 * resolveBaseUrl('https://proxy.local:4443/') // 'https://proxy.local:4443'
 * ```
 */
export function resolveBaseUrl(region: Region | (string & {})): string {
  const known = REGION_BASE_URLS[region as Region]
  return (known ?? region).replace(/\/+$/, '')
}
