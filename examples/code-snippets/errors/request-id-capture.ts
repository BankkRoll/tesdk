/**
 * @file Capturing the request id Tesla support asks for.
 *
 * Prerequisites: none.
 */

import { TeslaClient, TeslaError, type RequestLogEntry } from 'tesdk'

/** A failure, reduced to what a support ticket needs. */
export interface SupportReport {
  /** Value of the `x-txid` response header. */
  requestId: string | undefined
  code: string
  status: number | undefined
  message: string
  occurredAt: string
  /** Response body, which usually carries Tesla's own error string. */
  body: unknown
}

/**
 * Reduces a failure to a report worth attaching to a ticket.
 *
 * `requestId` is the one field Tesla support cannot work without: it identifies
 * the exact request in their logs. It is only present on failures that produced
 * a response, so a `ConnectionError` or `TimeoutError` will not carry one.
 *
 * @param error - Anything caught from an SDK call.
 * @returns The report, or `undefined` for errors this SDK did not raise.
 *
 * @example
 * ```ts
 * catch (error) {
 *   const report = supportReport(error)
 *   if (report) logger.error({ tesla: report }, 'Fleet API call failed')
 * }
 * ```
 */
export function supportReport(error: unknown): SupportReport | undefined {
  if (!(error instanceof TeslaError)) return undefined

  return {
    requestId: error.requestId,
    code: error.code,
    status: error.status,
    message: error.message,
    occurredAt: new Date().toISOString(),
    body: error.body,
  }
}

/**
 * Builds a client that records the last request ids seen.
 *
 * Errors carry their own id, but a *successful* request that produced the wrong
 * data has none to report from a catch block. Keeping a short ring buffer means
 * the id is still available when someone notices the problem minutes later.
 *
 * @param accessToken - Bearer token.
 * @param keep - How many entries to retain.
 * @returns The client and a reader for the recent log.
 */
export function clientWithRequestLog(
  accessToken: string,
  keep = 50,
): { client: TeslaClient; recent: () => RequestLogEntry[] } {
  const log: RequestLogEntry[] = []

  const client = new TeslaClient({
    accessToken,
    onRequest: (entry) => {
      log.push(entry)
      if (log.length > keep) log.shift()
    },
  })

  return { client, recent: () => [...log] }
}
