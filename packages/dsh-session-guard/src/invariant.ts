/**
 * Exhaustiveness backstop for closed unions.
 *
 * @module @aimercat/dsh-session-guard/invariant
 */

/** Fail loudly if a locally closed union gains an unhandled member. */
export function assertNever(value: never): never {
  throw new TypeError(`unhandled closed-union member: ${String(value)}`)
}
