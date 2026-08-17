/**
 * Module A — output-truncation continuation guard.
 *
 * When a model response is cut off at the output token limit
 * (`finish_reason: length`), the host agent loop ends the turn with
 * `turn/end` reason `max-tokens` and offers no recovery: the session just
 * stops. This module watches that boundary and wakes the owning agent with a
 * follow-up continuation message (Claude Code continuation-prompt lineage),
 * bounded per session by `maxContinuations`.
 *
 * Safety: if the truncated assistant message still carries tool calls that
 * were never answered by a `tool/result`, a continuation user message would
 * be an invalid wire sequence for OpenAI-compatible providers (a tool-call
 * turn must be followed by tool results). In that case the guard refuses to
 * continue and reports a failure to the circuit breaker instead.
 *
 * @module @aimercat/dsh-session-guard/continuation
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContinuationConfig } from './types.ts'
import type { GuardSessionLike } from './types.ts'

/** The plugin tag attached to synthesized continuation messages. */
export const GUARD_PLUGIN_TAG = 'dsh-session-guard'

/** Look backward for the last assistant message and report unclosed tool calls. */
export function hasUnclosedToolCalls(session: GuardSessionLike): boolean {
  const nodes = session.surface.nodes
  const events = session.events
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const seq = nodes[index]
    const event = events[seq]
    if (event === undefined) continue
    if (event.type !== 'assistant/message') continue
    const content = event.data?.message?.content ?? []
    const calls = content.filter((block) => block.type === 'tool-call' && block.id !== undefined && block.id.length > 0)
    if (calls.length === 0) return false
    const covered = new Set<string>()
    for (let after = index + 1; after < nodes.length; after += 1) {
      const later = events[nodes[after]]
      if (later === undefined) continue
      if (later.type === 'tool/result') {
        const callId = later.data?.message?.source?.callId
        if (callId !== undefined && callId.length > 0) covered.add(callId)
      }
    }
    return calls.some((call) => !covered.has(call.id as string))
  }
  return false
}

/**
 * Build the continuation message for one retry attempt.
 * @param prompt - configured continuation prompt.
 * @param attempt - 1-based attempt number.
 * @returns a plugin-sourced user message ready for `agent.followup`.
 */
export function buildContinuationMessage(prompt: string, attempt: number): ReturnType<typeof createUserMessage> {
  const suffix = attempt > 1
    ? `\n\n(Continuation attempt ${attempt}. Keep responses short.)`
    : ''
  return createUserMessage({
    content: [{ type: 'text', text: `${prompt}${suffix}` }],
    source: { kind: 'plugin', plugin: GUARD_PLUGIN_TAG },
  })
}

/** A minimal structural view of the owning agent for the continuation call. */
export interface GuardAgentLike {
  readonly session: GuardSessionLike
  followup(message: unknown): void
}

/**
 * Decide whether the guard should continue this truncated turn and, when it
 * can, wake the agent with the continuation message.
 * @param agent - the owner agent of the session (may be missing).
 * @param session - the session whose last turn ended with max-tokens.
 * @param config - resolved continuation configuration.
 * @param counts - mutable per-session continuation counter (session id key).
 * @returns `{continued: true, attempt}` when a continuation was dispatched;
 * `{continued: false, reason}` otherwise.
 */
export function maybeContinueTurn(
  agent: GuardAgentLike | undefined,
  session: GuardSessionLike,
  config: ContinuationConfig,
  counts: Map<string, number>,
): { continued: boolean; attempt?: number; reason?: 'no-agent' | 'unclosed-tool-calls' | 'limit-reached' } {
  if (agent === undefined) return { continued: false, reason: 'no-agent' }
  if (hasUnclosedToolCalls(session)) return { continued: false, reason: 'unclosed-tool-calls' }
  const attempt = (counts.get(session.id) ?? 0) + 1
  if (attempt > config.maxContinuations) return { continued: false, reason: 'limit-reached' }
  counts.set(session.id, attempt)
  agent.followup(buildContinuationMessage(config.prompt, attempt))
  return { continued: true, attempt }
}
