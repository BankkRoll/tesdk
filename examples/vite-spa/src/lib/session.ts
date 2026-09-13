/**
 * @file Browser-side storage for the token set and the pending OAuth exchange.
 *
 * Both live in `sessionStorage`, which scopes them to the tab and clears them
 * when it closes. That is the right trade-off for an example, but it is worth
 * being clear about what it is: any script running on this origin can read the
 * access token, so an XSS bug is a token compromise.
 *
 * A production SPA keeps tokens out of JavaScript entirely — the backend that
 * proxies Fleet API also owns the session and sets an httpOnly cookie — and
 * this module is the seam where that swap happens.
 */

import type { TokenSet } from 'tesdk'

/** Key holding the serialized {@link TokenSet}. */
const SESSION_KEY = 'tesdk.session'

/** Key holding the {@link PendingAuth} for the in-flight authorize redirect. */
const PENDING_KEY = 'tesdk.pending'

/** Values carried across the redirect to Tesla and back. */
export interface PendingAuth {
  /** Anti-forgery value echoed back on the callback and compared there. */
  state: string
  /** PKCE verifier, never sent on the authorize request. */
  verifier: string
}

/**
 * Reads and parses a JSON value, treating corruption as absence.
 *
 * Storage can hold a value written by an older build of the app, so a parse
 * failure is an expected state rather than an error worth surfacing.
 */
function read<T>(key: string): T | undefined {
  const raw = sessionStorage.getItem(key)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    sessionStorage.removeItem(key)
    return undefined
  }
}

/** Returns the stored token set, or `undefined` when signed out. */
export function loadSession(): TokenSet | undefined {
  return read<TokenSet>(SESSION_KEY)
}

/**
 * Persists a token set.
 *
 * @param tokens - Credentials to store, replacing any existing set.
 */
export function saveSession(tokens: TokenSet): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(tokens))
}

/** Discards the token set, signing the visitor out of this tab. */
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

/**
 * Stores the PKCE verifier and CSRF state before redirecting to Tesla.
 *
 * @param pending - Values the callback needs to complete the exchange.
 */
export function savePendingAuth(pending: PendingAuth): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
}

/**
 * Reads and clears the pending authorization.
 *
 * Single-use by construction: an authorization code is single-use too, so
 * leaving the verifier behind only invites a replay that cannot succeed.
 *
 * @returns The pending values, or `undefined` when no flow is in progress.
 */
export function takePendingAuth(): PendingAuth | undefined {
  const pending = read<PendingAuth>(PENDING_KEY)
  sessionStorage.removeItem(PENDING_KEY)
  return pending
}
