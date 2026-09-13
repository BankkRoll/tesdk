/**
 * @file Workers KV persistence for tokens and charge snapshots.
 *
 * A Worker isolate is discarded between invocations and there is no shared
 * process memory, so `MemoryTokenStore` would drop every refreshed token: the
 * cron run that rotates the refresh token and the HTTP request that needs it
 * five minutes later never share an isolate. KV is the smallest durable place
 * to put it.
 *
 * KV is eventually consistent across colos, which is acceptable here because
 * Tesla accepts the previous refresh token during a short grace window. A fleet
 * with concurrent writers from several regions wants a Durable Object or D1
 * instead.
 */

import { createTokenStore, type TokenSet, type TokenStore } from 'tesdk'

/** KV key holding the serialized {@link TokenSet}. */
const TOKENS_KEY = 'tesla:tokens'

/** KV key prefix for per-VIN charge snapshots. */
const SNAPSHOT_PREFIX = 'snapshot:'

/** KV key holding the outcome of the most recent scheduled run. */
const RUN_KEY = 'monitor:last-run'

/** A charge reading recorded by the scheduled monitor. */
export interface ChargeSnapshot {
  vin: string
  /** User-assigned vehicle name, `null` when never set. */
  displayName: string | null
  /** ISO 8601 timestamp of the reading. */
  recordedAt: string
  /** State of charge as a percentage, absent when the vehicle was unreachable. */
  batteryLevel?: number
  /** Estimated range in the account's distance unit. */
  range?: number
  chargingState?: string
  chargeLimit?: number
  /** Instantaneous charge rate in kilowatts. */
  chargerPower?: number
  /** Populated instead of the readings when the poll failed. */
  error?: string
}

/** Summary of one scheduled monitor run. */
export interface RunSummary {
  /** ISO 8601 timestamp of the cron trigger. */
  ranAt: string
  /** Cron expression that fired the run. */
  cron: string
  vehiclesPolled: number
  /** VINs skipped because they were asleep or offline. */
  skipped: string[]
  /** Human-readable failures, one per vehicle that errored. */
  errors: string[]
  durationMs: number
}

/**
 * Creates a {@link TokenStore} backed by a KV namespace.
 *
 * The SDK writes back through `set` on every refresh, so the rotated refresh
 * token is durable before the response the refresh unblocked is even sent.
 *
 * @param kv - Namespace bound as `TESLA_KV`.
 * @returns A store the client can read and write across invocations.
 *
 * @example
 * ```ts
 * const client = new TeslaClient({ clientId, clientSecret, tokenStore: kvTokenStore(env.TESLA_KV) })
 * ```
 */
export function kvTokenStore(kv: KVNamespace): TokenStore {
  return createTokenStore({
    async get(): Promise<TokenSet | undefined> {
      return (await kv.get<TokenSet>(TOKENS_KEY, 'json')) ?? undefined
    },
    async set(tokens: TokenSet): Promise<void> {
      await kv.put(TOKENS_KEY, JSON.stringify(tokens))
    },
    async clear(): Promise<void> {
      await kv.delete(TOKENS_KEY)
    },
  })
}

/**
 * Reports whether the Worker has been authorized.
 *
 * @param kv - Namespace bound as `TESLA_KV`.
 * @returns `true` once a token set has been stored by the OAuth callback.
 */
export async function hasTokens(kv: KVNamespace): Promise<boolean> {
  return (await kv.get(TOKENS_KEY)) !== null
}

/**
 * Records a charge reading, replacing any previous one for the same VIN.
 *
 * @param kv - Namespace bound as `TESLA_KV`.
 * @param snapshot - Reading to persist.
 */
export async function putSnapshot(kv: KVNamespace, snapshot: ChargeSnapshot): Promise<void> {
  await kv.put(SNAPSHOT_PREFIX + snapshot.vin, JSON.stringify(snapshot))
}

/**
 * Reads the most recent reading for one vehicle.
 *
 * @param kv - Namespace bound as `TESLA_KV`.
 * @param vin - Vehicle to look up.
 * @returns The snapshot, or `undefined` before the first successful poll.
 */
export async function getSnapshot(
  kv: KVNamespace,
  vin: string,
): Promise<ChargeSnapshot | undefined> {
  return (await kv.get<ChargeSnapshot>(SNAPSHOT_PREFIX + vin, 'json')) ?? undefined
}

/**
 * Lists every recorded snapshot.
 *
 * @param kv - Namespace bound as `TESLA_KV`.
 * @returns Snapshots in KV key order, which is by VIN.
 */
export async function listSnapshots(kv: KVNamespace): Promise<ChargeSnapshot[]> {
  const { keys } = await kv.list({ prefix: SNAPSHOT_PREFIX })
  const snapshots = await Promise.all(
    keys.map(async (key) => await kv.get<ChargeSnapshot>(key.name, 'json')),
  )
  return snapshots.filter((snapshot): snapshot is ChargeSnapshot => snapshot !== null)
}

/**
 * Records the outcome of a scheduled run so `/api/health` can expose it.
 *
 * @param kv - Namespace bound as `TESLA_KV`.
 * @param summary - Outcome of the run that just finished.
 */
export async function putRunSummary(kv: KVNamespace, summary: RunSummary): Promise<void> {
  await kv.put(RUN_KEY, JSON.stringify(summary))
}

/**
 * Reads the outcome of the most recent scheduled run.
 *
 * @param kv - Namespace bound as `TESLA_KV`.
 * @returns The summary, or `undefined` before the first cron trigger.
 */
export async function getRunSummary(kv: KVNamespace): Promise<RunSummary | undefined> {
  return (await kv.get<RunSummary>(RUN_KEY, 'json')) ?? undefined
}
