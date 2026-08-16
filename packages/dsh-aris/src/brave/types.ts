import type { ToolExecution } from '@deepseek-ai/dsh-tools'

/**
 * Policy result for one tool call under the brave permission preset.
 *
 * The brave policy is fully deterministic: no LLM classifier is involved, so
 * every decision is either a static allow, a static deny, or an ask that
 * delegates to the approval pipeline (one-shot human confirmation in the GUI,
 * fail-closed rejection in headless/subagent contexts).
 */
export interface Assessment {
  readonly decision: 'allow' | 'ask' | 'deny'
  readonly reason: string
  /** Exact paths this call plans to create, promoted to the artifact registry on success. */
  readonly plannedCreates?: readonly string[]
}

/** Minimum execution fields used by pure policy helpers. */
export type PendingExecution = Pick<ToolExecution, 'name' | 'arguments' | 'agent' | 'token'>
