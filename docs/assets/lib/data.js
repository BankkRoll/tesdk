/**
 * @file The generated API data, shared by every page and component.
 *
 * A module-level holder rather than a parameter threaded through every render
 * function: the data is loaded once at boot and never changes, so passing it
 * down would be ceremony without benefit.
 */

/** @type {any} */
let api = null

/**
 * Stores the loaded API data. Called once, from the entry point.
 *
 * @param data - Parsed `api.json`.
 */
export function setApi(data) {
  api = data
}

/**
 * Returns the loaded API data.
 *
 * @throws {Error} When called before the entry point has loaded the data.
 */
export function getApi() {
  if (!api) throw new Error('API data read before boot completed')
  return api
}
