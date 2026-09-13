/**
 * @file A `TokenStore` backed by a Redis-shaped key-value client.
 *
 * Prerequisites: any client exposing `get`, `set`, and `del`. The interface
 * below is declared locally so the snippet compiles without a Redis dependency;
 * `ioredis` and `@upstash/redis` both satisfy it.
 */

import { createTokenStore, type TokenSet, type TokenStore } from 'tesdk'

/** The subset of a Redis client this store needs. */
export interface RedisLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<unknown>
  del(key: string): Promise<unknown>
}

/**
 * Persists one user's tokens under a namespaced Redis key.
 *
 * No TTL is set: the refresh token outlives the access token by weeks, and
 * expiring the record would silently sign the user out. The SDK checks
 * `expiresAt` itself.
 *
 * @param redis - Redis client.
 * @param userId - Identifier scoping the key to one user.
 *
 * @example
 * ```ts
 * const client = new TeslaClient({
 *   clientId,
 *   clientSecret,
 *   tokenStore: redisTokenStore(redis, userId),
 * })
 * ```
 */
export function redisTokenStore(redis: RedisLike, userId: string): TokenStore {
  const key = `tesla:tokens:${userId}`

  return createTokenStore({
    async get(): Promise<TokenSet | undefined> {
      const raw = await redis.get(key)
      if (!raw) return undefined
      try {
        return JSON.parse(raw) as TokenSet
      } catch {
        // A corrupt record is indistinguishable from no record for the caller;
        // treating it as absent forces a clean re-authorization.
        return undefined
      }
    },
    async set(tokens: TokenSet): Promise<void> {
      await redis.set(key, JSON.stringify(tokens))
    },
    async clear(): Promise<void> {
      await redis.del(key)
    },
  })
}
