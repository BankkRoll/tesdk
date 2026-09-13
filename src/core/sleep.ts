/**
 * @file Abortable delay shared by the retry loop and wake polling.
 */

/**
 * Resolves after `ms`, rejecting immediately if `signal` aborts.
 *
 * @param ms - Delay in milliseconds.
 * @param signal - Optional cancellation signal.
 * @throws The signal's abort reason when cancelled.
 * @internal
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason as Error)
      return
    }

    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal?.reason as Error)
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
