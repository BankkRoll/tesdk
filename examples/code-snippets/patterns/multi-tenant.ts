/**
 * @file One client per user, in a server that serves many.
 *
 * Prerequisites: a `TokenStore` implementation per user — see
 * `auth/postgres-token-store.ts` and `auth/redis-token-store.ts`.
 */

import { TeslaClient, type TokenStore } from 'tesdk'

/** Builds the store holding one user's credentials. */
export type StoreFactory = (userId: string) => TokenStore

/**
 * Creates clients per user, caching them for a bounded time.
 *
 * A client is not stateless: it holds the single-flight refresh lock. Building a
 * fresh one per request would let concurrent requests for the same user each
 * refresh independently, and Tesla invalidates the previous refresh token on
 * every renewal — so the racing renewals would log the user out.
 *
 * The cache is bounded by time rather than by size, so a user who stops making
 * requests eventually releases their entry.
 *
 * @param storeFor - Builds a token store for a user id.
 * @param options - Region and idle eviction window.
 * @returns A `get` returning the user's client, and an `evict` for sign-out.
 *
 * @example
 * ```ts
 * const clients = clientPool((userId) => pgTokenStore(db, userId))
 * const client = clients.get(session.userId)
 * ```
 */
export function clientPool(
  storeFor: StoreFactory,
  options: { region?: 'na' | 'eu' | 'cn'; idleMs?: number } = {},
): { get: (userId: string) => TeslaClient; evict: (userId: string) => void; size: () => number } {
  const { region = 'na', idleMs = 15 * 60_000 } = options
  const cache = new Map<string, { client: TeslaClient; touchedAt: number }>()

  const sweep = (now: number): void => {
    for (const [userId, entry] of cache) {
      if (now - entry.touchedAt > idleMs) cache.delete(userId)
    }
  }

  return {
    get(userId: string): TeslaClient {
      const now = Date.now()
      sweep(now)

      const existing = cache.get(userId)
      if (existing) {
        existing.touchedAt = now
        return existing.client
      }

      const client = new TeslaClient({
        region,
        clientId: process.env['TESLA_CLIENT_ID'],
        clientSecret: process.env['TESLA_CLIENT_SECRET'],
        tokenStore: storeFor(userId),
      })
      cache.set(userId, { client, touchedAt: now })
      return client
    },

    evict(userId: string): void {
      cache.delete(userId)
    },

    size(): number {
      return cache.size
    },
  }
}

/**
 * Creates a client for a user whose region is already known.
 *
 * Storing the region at sign-up saves a `users/region` lookup on every cold
 * start, which matters most on serverless, where every request is a cold start.
 *
 * @param storeFor - Builds a token store for a user id.
 * @param userId - User to build a client for.
 * @param baseUrl - The regional base URL recorded for this user.
 */
export function clientForKnownRegion(
  storeFor: StoreFactory,
  userId: string,
  baseUrl: string,
): TeslaClient {
  return new TeslaClient({
    baseUrl,
    clientId: process.env['TESLA_CLIENT_ID'],
    clientSecret: process.env['TESLA_CLIENT_SECRET'],
    tokenStore: storeFor(userId),
  })
}
