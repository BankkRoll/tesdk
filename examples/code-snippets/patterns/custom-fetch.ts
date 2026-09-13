/**
 * @file Injecting a custom `fetch`, for tests and for runtime-specific agents.
 *
 * Prerequisites: none.
 */

import { TeslaClient, type FetchLike } from '@bankkroll/tesdk'

/**
 * Builds a `fetch` that answers from a fixture table instead of the network.
 *
 * Faster and more deterministic than a mock server, and it exercises the real
 * transport: retry policy, error mapping, and envelope unwrapping all run
 * exactly as they do in production.
 *
 * @param routes - Response bodies keyed by the path the SDK will request.
 * @returns A `fetch` returning 200 for known paths and 404 for everything else.
 *
 * @example
 * ```ts
 * const client = new TeslaClient({
 *   accessToken: 'test',
 *   fetch: fixtureFetch({ '/api/1/vehicles': { response: [] } }),
 * })
 * ```
 */
export function fixtureFetch(routes: Record<string, unknown>): FetchLike {
  return (input: string): Promise<Response> => {
    const { pathname } = new URL(input)
    const body = routes[pathname]

    if (body === undefined) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: 'not_found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      )
    }

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }
}

/**
 * Wraps a `fetch` so every request and its outcome is recorded.
 *
 * Distinct from `onRequest`, which reports what the SDK did. This sees the
 * actual `Request` and `Response`, so it can assert on headers and bodies.
 *
 * @param inner - Underlying implementation.
 * @param calls - Array appended to on each call.
 */
export function recordingFetch(
  inner: FetchLike,
  calls: { url: string; method: string; status: number }[],
): FetchLike {
  return async (input, init) => {
    const response = await inner(input, init)
    calls.push({ url: input, method: init?.method ?? 'GET', status: response.status })
    return response
  }
}

/**
 * Builds a `fetch` that fails a set number of times before succeeding.
 *
 * The way to assert that the retry policy actually engages, and that
 * non-idempotent commands are not retried.
 *
 * @param failures - How many attempts return 503 before the first success.
 * @param inner - Implementation used once the failures are exhausted.
 */
export function flakyFetch(failures: number, inner: FetchLike): FetchLike {
  let remaining = failures

  return (input, init) => {
    if (remaining > 0) {
      remaining -= 1
      return Promise.resolve(new Response('upstream unavailable', { status: 503 }))
    }
    return inner(input, init)
  }
}

/**
 * Builds a client wired to fixtures, ready for assertions.
 *
 * @param routes - Response bodies keyed by request path.
 */
export function testClient(routes: Record<string, unknown>): TeslaClient {
  return new TeslaClient({
    accessToken: 'test-token',
    fetch: fixtureFetch(routes),
    // Retries would multiply every fixture miss into several seconds of
    // backoff, turning a failing assertion into a slow one.
    retry: { maxRetries: 0 },
  })
}
