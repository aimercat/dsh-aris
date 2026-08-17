/**
 * Shared types for @aimercat/dsh-session-guard.
 *
 * @module @aimercat/dsh-session-guard/types
 */

/** Module A: output-truncation continuation guard. */
export interface ContinuationConfig {
  /** Whether max-tokens turns are auto-continued with a follow-up prompt. */
  enabled: boolean
  /** Max consecutive continuations per session before giving up. */
  maxContinuations: number
  /** The follow-up prompt handed to the model after a truncation. */
  prompt: string
}

/** Module B: early compaction sentinel. */
export interface SentinelConfig {
  /** Whether the early-compaction pass runs on pre-step pressure. */
  enabled: boolean
  /** Compact when measured tokens exceed this share of the declared window. */
  earlyThresholdRatio: number
  /** Recent tail fraction kept verbatim by the sentinel's own compaction. */
  retainRatio: number
  /** Max sequential compaction rounds per pre-step before yielding. */
  maxRounds: number
}

/** Module C: circuit breaker. */
export interface BreakerConfig {
  /** Whether consecutive failures trip the guard per session. */
  enabled: boolean
  /** Consecutive failures after which the guard stops for the session. */
  maxFailures: number
}

/** Module C: failure checkpoint archive. */
export interface CheckpointConfig {
  /** Whether context-overflow failures are archived as checkpoint files. */
  enabled: boolean
  /** Directory under the workspace root holding checkpoints. */
  dir: string
}

/** Complete resolved guard configuration. */
export interface GuardConfig {
  /** Master switch. */
  enabled: boolean
  continuation: ContinuationConfig
  sentinel: SentinelConfig
  breaker: BreakerConfig
  checkpoint: CheckpointConfig
}

/** Raw (unvalidated) plugin config as supplied by the loader. */
export type GuardConfigInput = Partial<{
  enabled: boolean
  continuation: Partial<ContinuationConfig>
  sentinel: Partial<SentinelConfig>
  breaker: Partial<BreakerConfig>
  checkpoint: Partial<CheckpointConfig>
}>

/** The subset of a session the guard reads. Structural, for tests. */
export interface GuardSessionLike {
  readonly id: string
  readonly events: readonly GuardEventLike[]
  readonly surface: {
    readonly nodes: readonly number[]
  }
  /** Optional derived-message export used by the checkpoint archive. */
  deriveMessages?(): readonly unknown[]
}

/** The subset of a session event the guard reads. */
export interface GuardEventLike {
  readonly seq: number
  readonly type: string
  readonly data?: {
    readonly turn?: number
    readonly reason?: {
      readonly kind?: string
      readonly error?: {
        readonly message?: string
        readonly code?: string
      }
    }
    readonly message?: {
      readonly content?: readonly {
        readonly type?: string
        readonly id?: string
      }[]
      readonly source?: {
        readonly callId?: string
      }
    }
  }
}

/** One priced surface node as reported by the token meter. */
export interface PricedNode {
  readonly seq: number
  readonly tokens: number
}

/** The token-meter measurement subset the sentinel needs. */
export interface TokenMeasurementLike {
  readonly nodes: readonly PricedNode[]
  readonly totalTokens: number
}

/** One token-meter message estimate (used to price the summary). */
export interface MessageEstimateLike {
  readonly tokens: number
}

/** Result of one sentinel compaction round. */
export interface CompactionRoundResult {
  readonly shadowedSeqs: readonly number[]
  readonly shadowedTokenCount: number
}
