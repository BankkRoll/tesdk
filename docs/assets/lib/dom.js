/**
 * @file DOM helpers and HTML escaping shared by every module.
 */

/** Queries a single element, scoped to `root` when given. */
export const $ = (sel, root = document) => root.querySelector(sel)

/** Queries every match as an array. */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

/**
 * Escapes text for safe interpolation into an HTML template.
 *
 * @param s - Untrusted text.
 * @returns The text with HTML metacharacters replaced by entities.
 */
export const esc = (s = '') =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
