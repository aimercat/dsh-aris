/**
 * Load-time validation for the session-guard configuration: strict key
 * whitelists (a misspelled key fails loud instead of hiding behind defaults),
 * ratio range checks, and a detached immutable resolved snapshot.
 *
 * @module @aimercat/dsh-session-guard/config
 */

import { deepFreeze } from './util.ts'
import type { BreakerConfig, CheckpointConfig, ContinuationConfig, GuardConfig, GuardConfigInput, SentinelConfig } from './types.ts'

/** Default continuation prompt (Claude Code continuation-prompt lineage). */
export const DEFAULT_CONTINUATION_PROMPT = [
  'Your previous response hit the output token limit and was cut off.',
  'Resume directly — no apology, no recap of what you were doing. Pick up mid-thought where the cut happened. Break the remaining work into smaller pieces so the next response stays within the output budget.',
].join(' ')

/** Master-switch default. */
export const DEFAULT_ENABLED = true

const CONTINUATION_KEYS = new Set(['enabled', 'maxContinuations', 'prompt'])
const SENTINEL_KEYS = new Set(['enabled', 'earlyThresholdRatio', 'retainRatio', 'maxRounds'])
const BREAKER_KEYS = new Set(['enabled', 'maxFailures'])
const CHECKPOINT_KEYS = new Set(['enabled', 'dir'])
const TOP_KEYS = new Set(['enabled', 'continuation', 'sentinel', 'breaker', 'checkpoint'])

/**
 * Resolve and validate the raw plugin config into a detached immutable
 * snapshot with all defaults applied.
 * @param config - untrusted plugin configuration after loader normalization.
 * @returns the resolved, deeply frozen guard configuration.
 */
export function resolveConfig(config: GuardConfigInput = {}): GuardConfig {
  for (const key of Object.keys(config)) {
    if (!TOP_KEYS.has(key)) throw new Error(`SessionGuardConfig: unknown key "${key}"`)
  }
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    throw new Error('SessionGuardConfig: enabled must be a boolean')
  }
  const continuation = resolveContinuation(config.continuation)
  const sentinel = resolveSentinel(config.sentinel)
  const breaker = resolveBreaker(config.breaker)
  const checkpoint = resolveCheckpoint(config.checkpoint)
  return deepFreeze({
    enabled: config.enabled ?? DEFAULT_ENABLED,
    continuation,
    sentinel,
    breaker,
    checkpoint,
  })
}

function resolveContinuation(source: GuardConfigInput['continuation'] = {}): ContinuationConfig {
  for (const key of Object.keys(source)) {
    if (!CONTINUATION_KEYS.has(key)) throw new Error(`SessionGuardConfig: continuation has unknown key "${key}"`)
  }
  if (source.enabled !== undefined && typeof source.enabled !== 'boolean') {
    throw new Error('SessionGuardConfig: continuation.enabled must be a boolean')
  }
  if (source.maxContinuations !== undefined) assertNonNegativeInteger('continuation.maxContinuations', source.maxContinuations)
  if (source.prompt !== undefined && typeof source.prompt !== 'string') {
    throw new Error('SessionGuardConfig: continuation.prompt must be a string')
  }
  return {
    enabled: source.enabled ?? true,
    maxContinuations: source.maxContinuations ?? 3,
    prompt: source.prompt ?? DEFAULT_CONTINUATION_PROMPT,
  }
}

function resolveSentinel(source: GuardConfigInput['sentinel'] = {}): SentinelConfig {
  for (const key of Object.keys(source)) {
    if (!SENTINEL_KEYS.has(key)) throw new Error(`SessionGuardConfig: sentinel has unknown key "${key}"`)
  }
  if (source.enabled !== undefined && typeof source.enabled !== 'boolean') {
    throw new Error('SessionGuardConfig: sentinel.enabled must be a boolean')
  }
  if (source.earlyThresholdRatio !== undefined) assertRatio('sentinel.earlyThresholdRatio', source.earlyThresholdRatio)
  if (source.retainRatio !== undefined) assertRatio('sentinel.retainRatio', source.retainRatio)
  if (source.maxRounds !== undefined) assertPositiveInteger('sentinel.maxRounds', source.maxRounds)
  const earlyThresholdRatio = source.earlyThresholdRatio ?? 0.7
  const retainRatio = source.retainRatio ?? 0.16
  if (retainRatio >= earlyThresholdRatio) {
    throw new Error(`SessionGuardConfig: sentinel.retainRatio (${retainRatio}) must be less than sentinel.earlyThresholdRatio (${earlyThresholdRatio})`)
  }
  return {
    enabled: source.enabled ?? true,
    earlyThresholdRatio,
    retainRatio,
    maxRounds: source.maxRounds ?? 2,
  }
}

function resolveBreaker(source: GuardConfigInput['breaker'] = {}): BreakerConfig {
  for (const key of Object.keys(source)) {
    if (!BREAKER_KEYS.has(key)) throw new Error(`SessionGuardConfig: breaker has unknown key "${key}"`)
  }
  if (source.enabled !== undefined && typeof source.enabled !== 'boolean') {
    throw new Error('SessionGuardConfig: breaker.enabled must be a boolean')
  }
  if (source.maxFailures !== undefined) assertPositiveInteger('breaker.maxFailures', source.maxFailures)
  return {
    enabled: source.enabled ?? true,
    maxFailures: source.maxFailures ?? 3,
  }
}

function resolveCheckpoint(source: GuardConfigInput['checkpoint'] = {}): CheckpointConfig {
  for (const key of Object.keys(source)) {
    if (!CHECKPOINT_KEYS.has(key)) throw new Error(`SessionGuardConfig: checkpoint has unknown key "${key}"`)
  }
  if (source.enabled !== undefined && typeof source.enabled !== 'boolean') {
    throw new Error('SessionGuardConfig: checkpoint.enabled must be a boolean')
  }
  if (source.dir !== undefined && (typeof source.dir !== 'string' || source.dir.length === 0)) {
    throw new Error('SessionGuardConfig: checkpoint.dir must be a non-empty string')
  }
  return {
    enabled: source.enabled ?? true,
    dir: source.dir ?? '.dsh/session-guard',
  }
}

function assertRatio(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`SessionGuardConfig: ${name} (${String(value)}) must be a number in (0, 1]`)
  }
}

function assertPositiveInteger(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`SessionGuardConfig: ${name} (${String(value)}) must be a positive integer`)
  }
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`SessionGuardConfig: ${name} (${String(value)}) must be a non-negative integer`)
  }
}
