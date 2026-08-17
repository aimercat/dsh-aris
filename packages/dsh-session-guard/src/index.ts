/**
 * @aimercat/dsh-session-guard — context guard for DeepSeek Harness sessions.
 *
 * The host already compacts at 80% of the declared window and retries once
 * on context overflow, but a session can still die at the context edge:
 *
 * - an output-token truncation (`finish_reason: length`) ends the turn with
 *   no recovery — the session just stops;
 * - an overflow that survives the single recovery retry reaches the user;
 * - a compaction failure is only a log line, invisible to the user.
 *
 * This plugin adds the missing layers without re-implementing the engine:
 *
 * - Module A (continuation): auto-continue truncated turns with a
 *   continuation prompt, bounded per session, refusing unsafe continuations
 *   after unclosed tool calls;
 * - Module B (sentinel): compact earlier than the host (default 70%) so
 *   overflow rarely has to happen, delegating the durable transaction to the
 *   host's `compaction.compactRegion` when available;
 * - Module C (breaker + checkpoint): per-session circuit breaker against
 *   repeated guard failures, and a handoff checkpoint file when a
 *   context-overflow failure still reaches the user.
 *
 * @module @aimercat/dsh-session-guard
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_CONTINUATION_PROMPT, resolveConfig } from './config.ts'
import type { GuardConfigInput } from './types.ts'
import type { GuardSessionLike } from './types.ts'
import { GuardBreaker } from './breaker.ts'
import { maybeContinueTurn, type GuardAgentLike } from './continuation.ts'
import { maybeCompactEarly, type CompactionServiceLike, type LlmLike, type SentinelSessionLike, type TokenMeterLike } from './sentinel.ts'
import { writeFailureCheckpoint } from './checkpoint.ts'

/** Cordis plugin name. */
export const name = 'session-guard'

/** Required host services (both mounted by dsh-base in every profile). */
export const inject = ['tokenMeter', 'llm']

/** Model-facing plugin configuration. */
export const Config = Schema.object({
  enabled: Schema.boolean().default(true).description('会话守卫总开关。'),
  continuation: Schema.object({
    enabled: Schema.boolean().default(true).description('输出被 max_tokens 截断时自动续写。'),
    maxContinuations: Schema.number().step(1).min(0).default(3).description('每个会话最多连续续写次数。'),
    prompt: Schema.string().default(DEFAULT_CONTINUATION_PROMPT).description('续写提示词模板。'),
  }).description('输出续写守卫（Module A）。'),
  sentinel: Schema.object({
    enabled: Schema.boolean().default(true).description('提前压缩哨兵。'),
    earlyThresholdRatio: Schema.number().default(0.7).description('达到声明窗口的该比例时提前压缩（宿主为 0.8）。'),
    retainRatio: Schema.number().default(0.16).description('压缩时保留的尾部原文比例。'),
    maxRounds: Schema.number().step(1).min(1).default(2).description('单次 pre-step 最多压缩轮数。'),
  }).description('提前压缩哨兵（Module B）。'),
  breaker: Schema.object({
    enabled: Schema.boolean().default(true).description('按会话的连续失败熔断。'),
    maxFailures: Schema.number().step(1).min(1).default(3).description('熔断阈值（连续失败次数）。'),
  }).description('熔断器（Module C）。'),
  checkpoint: Schema.object({
    enabled: Schema.boolean().default(true).description('上下文溢出失败时写存档文档。'),
    dir: Schema.string().default('.dsh/session-guard').description('存档目录（工作区相对路径）。'),
  }).description('失败存档（Module C）。'),
})

/** Register the session guard. */
export function apply(ctx: Context, config: GuardConfigInput): void {
  const resolved = resolveConfig(config)
  if (!resolved.enabled) return
  const agentBySession = new WeakMap<object, GuardAgentLike>()
  const continuationCounts = new Map<string, number>()
  const breaker = new GuardBreaker(resolved.breaker)

  // Host event names are declared dynamically by the runtime; bind through a
  // string-keyed on() so the plugin stays type-safe on its own payloads.
  const on = ctx.on.bind(ctx) as (event: string, listener: (...args: never[]) => unknown) => void

  // Keep the session → agent mapping warm for continuation wake-ups, and run
  // the early-compaction sentinel at the step boundary (serial with the
  // host's own pressure pass, so no concurrent compaction can occur).
  on('agent/pre-step', async ({ agent, signal }: { agent: GuardAgentLike & { session: SentinelSessionLike }; signal: AbortSignal }, next: () => void | Promise<void>) => {
    agentBySession.set(agent.session, agent)
    try {
      if (breaker.isTripped(agent.session.id)) return next()
      if (resolved.sentinel.enabled) {
        const compaction = ctx.get('compaction') as CompactionServiceLike | undefined
        const meter = ctx.get('tokenMeter') as TokenMeterLike | undefined
        const llm = ctx.get('llm') as LlmLike | undefined
        if (meter !== undefined && llm !== undefined) {
          const result = await maybeCompactEarly(compaction, meter, llm, agent.session, agent, signal, resolved.sentinel)
          if (result !== null) {
            ctx.logger.info(`session-guard: early-compacted ${result.shadowedSeqs.length} surface nodes (~${result.shadowedTokenCount} tokens)`)
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      ctx.logger.warn(`session-guard: early compaction failed: ${message}`)
      if (breaker.recordFailure(agent.session.id)) ctx.logger.warn('session-guard: circuit breaker tripped for this session')
    }
    return next()
  })

  // Watch turn boundaries: continue truncations, archive overflow failures.
  on('session/event', (session: unknown, event: { type: string; data?: unknown }) => {
    if (event.type !== 'turn/end') return
    const data = event.data as { turn?: number; reason?: { kind?: string; error?: { message?: string; code?: string } } } | undefined
    const reason = data?.reason
    if (reason === undefined) return
    const guardSession = session as GuardSessionLike
    const turnLabel = String(data?.turn ?? '?')
    switch (reason.kind) {
      case 'max-tokens': {
        if (!resolved.continuation.enabled || breaker.isTripped(guardSession.id)) return
        const agent = agentBySession.get(session as object)
        const outcome = maybeContinueTurn(agent, guardSession, resolved.continuation, continuationCounts)
        if (outcome.continued) {
          ctx.logger.info(`session-guard: continued turn ${turnLabel} after max-tokens truncation (attempt ${outcome.attempt}/${resolved.continuation.maxContinuations})`)
        } else {
          ctx.logger.warn(`session-guard: cannot continue truncated turn ${turnLabel}: ${outcome.reason}`)
          if (outcome.reason === 'unclosed-tool-calls' || outcome.reason === 'no-agent') {
            if (breaker.recordFailure(guardSession.id)) ctx.logger.warn('session-guard: circuit breaker tripped for this session')
          }
        }
        return
      }
      case 'error': {
        if (reason.error?.code !== 'CONTEXT_WINDOW_EXCEEDED') return
        ctx.logger.warn(`session-guard: context-overflow failure reached the user (turn ${turnLabel}): ${reason.error.message ?? 'no message'}`)
        if (resolved.checkpoint.enabled) {
          void writeFailureCheckpoint(guardSession, data?.turn ?? 0, reason.error.message ?? '', resolved.checkpoint)
            .then((path) => {
              if (path !== null) ctx.logger.info(`session-guard: failure checkpoint written to ${path}`)
            })
            .catch((error) => {
              ctx.logger.warn(`session-guard: checkpoint write failed: ${error instanceof Error ? error.message : String(error)}`)
            })
        }
        if (breaker.recordFailure(guardSession.id)) ctx.logger.warn('session-guard: circuit breaker tripped for this session')
        return
      }
      case 'completed':
      case 'stop':
      case 'blocked': {
        breaker.recordSuccess(guardSession.id)
        continuationCounts.delete(guardSession.id)
        return
      }
      default:
        return
    }
  })
}
