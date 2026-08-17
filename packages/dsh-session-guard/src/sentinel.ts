/**
 * Module B — early compaction sentinel.
 *
 * The host compacts automatically at 80% of the declared context window and
 * gets exactly one overflow-recovery retry. This sentinel compacts earlier
 * (default 70%) so that overflow never has to happen: a compacted history
 * leaves a large verbatim tail and plenty of headroom for the next response.
 *
 * The sentinel does not re-implement a compaction engine — it selects a
 * balanced head range (recent tail kept verbatim, never splitting a
 * tool-call/result pair) and delegates the durable transaction to the host's
 * `compaction` service via `compactRegion` when that method exists. Without
 * it the sentinel degrades to observation only.
 *
 * The pre-step event chain is serial, so the sentinel and the host's own
 * pressure pass never run concurrently: whoever measures first wins, and the
 * second sees the updated surface.
 *
 * @module @aimercat/dsh-session-guard/sentinel
 */

import { toolPairingBalancedBefore } from '@deepseek-ai/dsh-compaction'
import type { GuardSessionLike, SentinelConfig, TokenMeasurementLike } from './types.ts'

/** The host's own default pressure threshold ratio (compaction-basic). */
export const HOST_THRESHOLD_RATIO = 0.8

/** Select the head-anchored range to compact, keeping `retainTokens` verbatim. */
export function selectEarlyRange(
  session: GuardSessionLike,
  measurement: TokenMeasurementLike,
  retainTokens: number,
): { start: number; end: number; shadowedSeqs: readonly number[] } | null {
  const pricedNodes = measurement.nodes
  if (pricedNodes.length === 0) return null
  const surfaceNodes = session.surface.nodes
  if (surfaceNodes.length !== pricedNodes.length) return null
  for (let index = 0; index < surfaceNodes.length; index += 1) {
    if (surfaceNodes[index] !== pricedNodes[index]?.seq) return null
  }
  let accumulated = 0
  let keepFromIdx = pricedNodes.length
  for (let index = pricedNodes.length - 1; index >= 0; index -= 1) {
    accumulated += pricedNodes[index].tokens
    keepFromIdx = index
    if (accumulated >= retainTokens) break
  }
  if (keepFromIdx === 0) return null
  while (keepFromIdx > 0) {
    if (toolPairingBalancedBefore(session as never, surfaceNodes[keepFromIdx] as never)) break
    keepFromIdx -= 1
  }
  if (keepFromIdx === 0) return null
  return {
    start: surfaceNodes[0],
    end: surfaceNodes[keepFromIdx - 1],
    shadowedSeqs: surfaceNodes.slice(0, keepFromIdx),
  }
}

/** Structural view of the host compaction service we delegate to. */
export interface CompactionServiceLike {
  compactRegion?(
    start: number,
    end: number,
    agent: unknown,
    signal: AbortSignal,
  ): Promise<{ shadowedSeqs: readonly number[]; shadowedTokenCount: number }>
}

/** Structural view of the token meter. */
export interface TokenMeterLike {
  measure(session: GuardSessionLike): TokenMeasurementLike
}

/** Structural view of the llm service (model info resolution). */
export interface LlmLike {
  resolveModelInfo(provider: string, model: string, signal: AbortSignal): Promise<{
    context?: { contextWindow?: number }
  }>
}

/** The session the sentinel reads (extends the guard session with request header). */
export interface SentinelSessionLike extends GuardSessionLike {
  requestHeader(): { config?: { provider?: string; model?: string } } | undefined
}

/**
 * Run one early-compaction pass against the latest measured pressure.
 * @param compaction - host compaction service (may lack `compactRegion`).
 * @param meter - token meter.
 * @param llm - llm service used to resolve the routed model's window.
 * @param session - session under pressure.
 * @param agent - owning agent (opaque to the sentinel).
 * @param signal - turn cancellation signal.
 * @param config - resolved sentinel configuration.
 * @returns the last compaction round result, or `null` when nothing ran.
 */
export async function maybeCompactEarly(
  compaction: CompactionServiceLike | undefined,
  meter: TokenMeterLike,
  llm: LlmLike,
  session: SentinelSessionLike,
  agent: unknown,
  signal: AbortSignal,
  config: SentinelConfig,
): Promise<{ shadowedSeqs: readonly number[]; shadowedTokenCount: number } | null> {
  if (!config.enabled) return null
  const header = session.requestHeader()
  const target = header?.config
  if (target === undefined || target.provider === undefined || target.provider.length === 0 || target.model === undefined || target.model.length === 0) {
    return null
  }
  const info = await llm.resolveModelInfo(target.provider, target.model, signal)
  const contextWindow = info.context?.contextWindow
  if (contextWindow === undefined || !Number.isInteger(contextWindow) || contextWindow <= 0) return null
  const earlyThreshold = Math.floor(contextWindow * config.earlyThresholdRatio)
  const retainTokens = Math.floor(contextWindow * config.retainRatio)
  if (retainTokens >= earlyThreshold) return null
  if (compaction?.compactRegion === undefined) return null

  let measurement = meter.measure(session)
  if (measurement.totalTokens < earlyThreshold) return null
  // Stay out of the host's own band: it compacts at HOST_THRESHOLD_RATIO and
  // may have just run; only act inside the early band.
  if (measurement.totalTokens >= Math.floor(contextWindow * HOST_THRESHOLD_RATIO)) return null

  let result: { shadowedSeqs: readonly number[]; shadowedTokenCount: number } | null = null
  for (let round = 0; round < config.maxRounds; round += 1) {
    const range = selectEarlyRange(session, measurement, retainTokens)
    if (range === null) break
    result = await compaction.compactRegion(range.start, range.end, agent, signal)
    measurement = meter.measure(session)
    if (measurement.totalTokens < earlyThreshold) break
  }
  return result
}
