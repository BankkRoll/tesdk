/**
 * @file Built-in {@link TokenStore} implementations.
 */

import type { TokenSet, TokenStore } from './types.js'

/**
 * Holds tokens in process memory.
 *
 * Suitable for scripts and single-process servers. Tokens are lost on restart,
 * so long-lived deployments should persist the refresh token instead.
 *
 * @example
 * ```ts
 * const store = new MemoryTokenStore({ accessToken, refreshToken, expiresAt })
 * ```
 */
export class MemoryTokenStore implements TokenStore {
  private tokens: TokenSet | undefined

  constructor(initial?: TokenSet) {
    this.tokens = initial
  }

  get(): TokenSet | undefined {
    return this.tokens
  }

  set(tokens: TokenSet): void {
    this.tokens = tokens
  }

  clear(): void {
    this.tokens = undefined
  }
}

/**
 * Adapts arbitrary persistence into a {@link TokenStore}.
 *
 * @param handlers - Read and write callbacks, either sync or async.
 *
 * @example
 * ```ts
 * const store = createTokenStore({
 *   get: () => db.tokens.find(userId),
 *   set: (tokens) => db.tokens.upsert(userId, tokens),
 * })
 * ```
 */
export function createTokenStore(handlers: TokenStore): TokenStore {
  return handlers
}
