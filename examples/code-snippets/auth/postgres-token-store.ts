/**
 * @file A `TokenStore` backed by a Postgres row, with an in-request cache.
 *
 * Prerequisites: a table shaped like
 * `create table tesla_tokens (user_id text primary key, tokens jsonb not null,
 *  updated_at timestamptz not null default now())`.
 *
 * The query interface is declared locally so the snippet compiles without a
 * driver; `pg`, `postgres.js`, and most pools satisfy it.
 */

import { createTokenStore, type TokenSet, type TokenStore } from '@bankkroll/tesdk'

/** The subset of a Postgres driver this store needs. */
export interface QueryableDb {
  query<T>(sql: string, params: unknown[]): Promise<{ rows: T[] }>
}

/**
 * Persists one user's tokens in a `jsonb` column.
 *
 * `get` is called before every authenticated request, so the fetched value is
 * memoized for the lifetime of the store to keep a burst of parallel calls from
 * issuing a query each. `set` always writes through, since a dropped refresh
 * token cannot be recovered.
 *
 * @param db - Database handle or pool.
 * @param userId - Primary key of the row.
 *
 * @example
 * ```ts
 * // One store per request, so the memo cannot outlive the user's session.
 * const client = new TeslaClient({ clientId, clientSecret, tokenStore: pgTokenStore(db, userId) })
 * ```
 */
export function pgTokenStore(db: QueryableDb, userId: string): TokenStore {
  let cached: TokenSet | undefined

  return createTokenStore({
    async get(): Promise<TokenSet | undefined> {
      if (cached) return cached
      const { rows } = await db.query<{ tokens: TokenSet }>(
        'select tokens from tesla_tokens where user_id = $1',
        [userId],
      )
      cached = rows[0]?.tokens
      return cached
    },
    async set(tokens: TokenSet): Promise<void> {
      await db.query(
        `insert into tesla_tokens (user_id, tokens, updated_at)
         values ($1, $2, now())
         on conflict (user_id) do update set tokens = excluded.tokens, updated_at = now()`,
        [userId, JSON.stringify(tokens)],
      )
      cached = tokens
    },
    async clear(): Promise<void> {
      await db.query('delete from tesla_tokens where user_id = $1', [userId])
      cached = undefined
    },
  })
}
