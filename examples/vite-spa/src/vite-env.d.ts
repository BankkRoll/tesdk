/// <reference types="vite/client" />

/**
 * @file Types for the `VITE_`-prefixed environment variables this app reads.
 *
 * Declaring them turns a typo in `import.meta.env` into a compile error rather
 * than an `undefined` that only surfaces at runtime.
 */

interface ImportMetaEnv {
  /** Application client id from the Tesla developer portal. */
  readonly VITE_TESLA_CLIENT_ID?: string
  /** `na`, `eu`, or `cn`. Validated at startup. */
  readonly VITE_TESLA_REGION?: string
  /** Redirect URI registered on the Tesla application. */
  readonly VITE_TESLA_REDIRECT_URI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
