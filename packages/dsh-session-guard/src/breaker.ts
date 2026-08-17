/**
 * Module C — circuit breaker.
 *
 * Consecutive guard failures (un-continuable truncations, sentinel
 * compaction errors, context-overflow failures that reached the user) trip
 * the guard per session, so a systematically failing environment cannot burn
 * API budget retrying in a loop. A successful turn resets the counter.
 *
 * @module @aimercat/dsh-session-guard/breaker
 */

import type { BreakerConfig } from './types.ts'

/**
 * Per-session consecutive-failure tracking with a trip latch.
 */
export class GuardBreaker {
  private readonly failures = new Map<string, number>()
  private readonly tripped = new Set<string>()
  private readonly config: BreakerConfig

  constructor(config: BreakerConfig) {
    this.config = config
  }

  /** Whether the breaker is armed and this session has tripped it. */
  isTripped(sessionId: string): boolean {
    return this.config.enabled && this.tripped.has(sessionId)
  }

  /**
   * Record one failure for the session.
   * @returns `true` when this failure tripped the breaker.
   */
  recordFailure(sessionId: string): boolean {
    if (!this.config.enabled) return false
    const next = (this.failures.get(sessionId) ?? 0) + 1
    this.failures.set(sessionId, next)
    if (next >= this.config.maxFailures) {
      this.tripped.add(sessionId)
      return true
    }
    return false
  }

  /** Record a healthy turn boundary for the session (resets the counter). */
  recordSuccess(sessionId: string): void {
    this.failures.delete(sessionId)
    this.tripped.delete(sessionId)
  }

  /** Drop all state (session ended / new session). */
  reset(sessionId: string): void {
    this.failures.delete(sessionId)
    this.tripped.delete(sessionId)
  }

  /** Current consecutive-failure count for the session. */
  failuresFor(sessionId: string): number {
    return this.failures.get(sessionId) ?? 0
  }
}
