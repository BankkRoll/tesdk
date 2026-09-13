/**
 * @file Fetch-based transport used by every resource namespace.
 *
 * Responsibilities:
 * - Compose absolute URLs from a base URL, path, and query.
 * - Attach authorization, timeout, and cancellation to each attempt.
 * - Retry transient failures with exponential backoff and full jitter.
 * - Normalize every failure into a {@link TeslaError} subclass.
 *
 * Only Web Standard APIs are used (`fetch`, `AbortSignal`, `URL`), so the same
 * build runs on Node 20+, browsers, Cloudflare Workers, Deno, and Bun.
 */

import {
  ConnectionError,
  RateLimitError,
  TeslaError,
  TimeoutError,
  errorFromStatus,
} from './errors.js'
import { sleep } from './sleep.js'

/**
 * Minimal `fetch` signature accepted by the client, allowing a custom
 * implementation to be injected for testing or for runtime-specific agents.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Retry policy applied to idempotent requests. */
export interface RetryOptions {
  /** Number of retries after the initial attempt. Defaults to `2`. */
  maxRetries?: number
  /** Base backoff in milliseconds, doubled per attempt. Defaults to `500`. */
  initialDelayMs?: number
  /** Upper bound applied to any single backoff. Defaults to `8000`. */
  maxDelayMs?: number
}

/** Describes a single HTTP request. */
export interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT'
  /** Path relative to the base URL, with or without a leading slash. */
  path: string
  /** Query parameters; `undefined` and `null` values are omitted. */
  query?: Record<string, string | number | boolean | undefined | null>
  /** Value serialized as a JSON request body. */
  body?: unknown
  /** Per-request timeout in milliseconds, overriding the client default. */
  timeoutMs?: number
  /** Caller cancellation signal, composed with the timeout signal. */
  signal?: AbortSignal
  /** Headers merged over the client defaults. */
  headers?: Record<string, string>
  /** Retry overrides for this request. */
  retry?: RetryOptions
  /**
   * How to decode the response body.
   *
   * `json` parses JSON and falls back to text for other content types.
   * `binary` returns an `ArrayBuffer` unchanged, which is required for
   * endpoints such as PDF invoices where text decoding would corrupt bytes.
   *
   * @defaultValue `'json'`
   */
  responseType?: 'json' | 'binary'
  /**
   * Whether the request may be retried. Defaults to `true` for `GET`.
   * Non-idempotent commands such as `honk_horn` set this to `false` so a
   * retry cannot trigger a duplicate physical action.
   */
  idempotent?: boolean
}

/** Construction options for {@link HttpClient}. */
export interface HttpClientConfig {
  baseUrl: string
  fetch: FetchLike
  timeoutMs: number
  retry: Required<RetryOptions>
  userAgent: string
  defaultHeaders?: Record<string, string>
  /**
   * Supplies the `Authorization` header value, refreshing the access token
   * when required. Omit for unauthenticated clients.
   */
  getAuthHeader?: () => Promise<string | undefined>
  /** Called once per attempt with timing and outcome, for logging or metrics. */
  onRequest?: (info: RequestLogEntry) => void
}

/** Diagnostic record emitted once per request attempt. */
export interface RequestLogEntry {
  method: string
  url: string
  /** 1-based attempt number. */
  attempt: number
  /** Response status, absent when the request failed before a response. */
  status?: number
  durationMs: number
  /** Thrown transport error, when the attempt produced no response. */
  error?: unknown
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

/**
 * Parses a `Retry-After` header value, which may be a delay in seconds or an
 * HTTP date.
 *
 * @returns Delay in milliseconds, or `undefined` when absent or unparseable.
 * @internal
 */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

/**
 * Extracts a human-readable message from an error response body.
 *
 * @internal
 */
function messageFromBody(body: unknown, status: number): string {
  if (typeof body === 'string' && body.trim()) return body.trim()
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    for (const key of ['error_description', 'error', 'message'] as const) {
      const value = record[key]
      if (typeof value === 'string' && value) return value
    }
  }
  return `HTTP ${status}`
}

/**
 * Transport layer shared by every resource namespace.
 *
 * Retries idempotent requests on transient failures using exponential backoff
 * with full jitter, honoring `Retry-After` when the server supplies it.
 */
export class HttpClient {
  private readonly config: HttpClientConfig

  constructor(config: HttpClientConfig) {
    this.config = config
  }

  /** Base URL in use, normalized without a trailing slash. */
  get baseUrl(): string {
    return this.config.baseUrl
  }

  /**
   * Performs a request and returns the decoded response body.
   *
   * @typeParam T - Expected shape of the decoded body.
   * @throws {TeslaError} A normalized subclass describing the failure.
   */
  async request<T>(options: RequestOptions): Promise<T> {
    const retry = { ...this.config.retry, ...options.retry }
    const allowRetry = options.idempotent ?? options.method === 'GET'
    const maxAttempts = allowRetry ? retry.maxRetries + 1 : 1
    const url = this.buildUrl(options.path, options.query)

    let lastError: TeslaError | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = Date.now()

      let response: Response
      try {
        response = await this.attempt(url, options)
      } catch (cause) {
        const error = this.normalizeThrown(cause, options.signal)
        this.config.onRequest?.({
          method: options.method,
          url,
          attempt,
          durationMs: Date.now() - startedAt,
          error: cause,
        })

        // A caller-initiated abort is deliberate and is never retried.
        if ((options.signal?.aborted ?? false) || attempt === maxAttempts) throw error

        lastError = error
        await sleep(this.backoff(attempt, retry), options.signal)
        continue
      }

      this.config.onRequest?.({
        method: options.method,
        url,
        attempt,
        status: response.status,
        durationMs: Date.now() - startedAt,
      })

      if (response.ok) return await this.decode<T>(response, options.responseType)

      const error = await this.errorFromResponse(response)

      // 408 signals an asleep or unreachable vehicle. Retrying without an
      // explicit wake_up cannot succeed, so it is excluded here.
      const retryable = RETRYABLE_STATUSES.has(response.status) && response.status !== 408
      if (!retryable || attempt === maxAttempts) throw error

      lastError = error
      const hinted =
        error instanceof RateLimitError && error.retryAfter !== undefined
          ? error.retryAfter * 1000
          : undefined
      await sleep(hinted ?? this.backoff(attempt, retry), options.signal)
    }

    throw lastError ?? new TeslaError('Request failed without a response')
  }

  /**
   * Issues a single attempt with authorization, headers, and a composed
   * timeout signal applied.
   */
  private async attempt(url: string, options: RequestOptions): Promise<Response> {
    const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? this.config.timeoutMs)
    const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...this.config.defaultHeaders,
      ...options.headers,
    }

    // Browsers reject attempts to set User-Agent, so it is sent only elsewhere.
    if (typeof document === 'undefined') headers['user-agent'] = this.config.userAgent

    const auth = await this.config.getAuthHeader?.()
    if (auth) headers.authorization = auth

    const init: RequestInit = { method: options.method, headers, signal }
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }

    return await this.config.fetch(url, init)
  }

  /**
   * Builds an absolute URL, omitting nullish query parameters.
   *
   * Concatenates rather than resolving against the base, so a base URL that
   * carries a path prefix — a reverse-proxied Vehicle Command Proxy, say —
   * keeps that prefix instead of having it replaced by the root-relative path.
   */
  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    const suffix = path.startsWith('/') ? path : `/${path}`
    const url = new URL(`${this.config.baseUrl}${suffix}`)
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    }
    return url.toString()
  }

  /** Decodes a successful response, tolerating empty and non-JSON bodies. */
  private async decode<T>(response: Response, responseType?: 'json' | 'binary'): Promise<T> {
    if (response.status === 204) return undefined as T
    if (responseType === 'binary') return (await response.arrayBuffer()) as T

    const text = await response.text()
    if (!text) return undefined as T
    if (!(response.headers.get('content-type') ?? '').includes('json')) return text as T
    try {
      return JSON.parse(text) as T
    } catch (cause) {
      throw new TeslaError('Failed to parse JSON response', {
        status: response.status,
        body: text,
        cause,
        ...this.responseMeta(response),
      })
    }
  }

  /** Converts a non-2xx response into the matching error subclass. */
  private async errorFromResponse(response: Response): Promise<TeslaError> {
    const text = await response.text().catch(() => '')
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : undefined
    } catch {
      // Gateway errors arrive as HTML; the raw text is preserved as the body.
    }
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'))
    return errorFromStatus(response.status, messageFromBody(body, response.status), {
      body,
      ...this.responseMeta(response),
      ...(retryAfter !== undefined ? { retryAfter: retryAfter / 1000 } : {}),
    })
  }

  /** Extracts the Tesla transaction id used for support escalations. */
  private responseMeta(response: Response): { requestId?: string } {
    const id = response.headers.get('x-txid')
    return id ? { requestId: id } : {}
  }

  /** Classifies a thrown transport failure by its abort reason. */
  private normalizeThrown(cause: unknown, callerSignal?: AbortSignal): TeslaError {
    const name = (cause as { name?: string } | undefined)?.name
    if (name === 'TimeoutError') return new TimeoutError('Request timed out', { cause })
    if (name === 'AbortError') {
      return callerSignal?.aborted
        ? new TimeoutError('Request aborted by caller', { cause })
        : new TimeoutError('Request timed out', { cause })
    }
    const message = cause instanceof Error ? cause.message : String(cause)
    return new ConnectionError(`Network request failed: ${message}`, { cause })
  }

  /**
   * Computes a backoff delay using full jitter, which spreads retries from
   * concurrent clients instead of synchronizing them into a burst.
   */
  private backoff(attempt: number, retry: Required<RetryOptions>): number {
    const ceiling = Math.min(retry.initialDelayMs * 2 ** (attempt - 1), retry.maxDelayMs)
    return Math.random() * ceiling
  }
}
