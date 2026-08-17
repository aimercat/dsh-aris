/**
 * Small shared helpers (deep freeze without a dependency).
 *
 * @module @aimercat/dsh-session-guard/util
 */

/** Recursively freeze a plain value and return it. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key])
    Object.freeze(value)
  }
  return value
}
