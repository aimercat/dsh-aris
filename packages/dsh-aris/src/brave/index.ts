/**
 * brave-permission-mode — the host policy half of the「勇者权限」(brave
 * permission) preset for the Aris plugin.
 *
 * Brave sits between Workspace Write and Full access in the permission
 * preset table: the sandbox is `danger-full-access` (so the brave domain can
 * extend beyond the workspace) but every tool call is judged by a
 * deterministic policy before it runs:
 *
 * - synchronous hard denies (privilege escalation, credential exfiltration,
 *   protected/system-path destruction) via the monotonic `tools.guard()`;
 * - automatic allows for routine reads/edits inside the brave domain
 *   (workspace ∪ configured braveRoots), build/test/verify commands, and
 *   exact deletion of session-created artifacts;
 * - one-shot approvals (`ask`) for pre-session deletion inside the domain,
 *   domain-external writes, Git/service/network mutation, and anything the
 *   static analysis cannot resolve (fail-closed);
 * - outright denies for deletion that could escape the domain.
 *
 * The policy is inactive unless the session's durable permission preset is
 * `brave` (or an official in-process subagent descends from such a session),
 * so Read Only / Workspace Write / Full access keep their stock behavior.
 *
 * Architecture follows `@nanmicoder/dsh-auto-mode` (MIT, Copyright (c) 2026
 * 程序员阿江-Relakkes); the brave layer replaces the LLM classifier with the
 * explicit brave-domain model and stricter deletion handling.
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { effectivePermissionPreset } from '@deepseek-ai/dsh-permission-presets'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import { ArtifactRegistry } from './artifacts.js'
import { resolveRoots, type PolicyRoots, type RootOptions } from './paths.js'
import { assessTool, hardDenyReason } from './policy.js'

export { ArtifactRegistry } from './artifacts.js'
export * from './paths.js'
export * from './policy.js'
export * from './shell.js'
export type * from './types.js'

/** Cordis plugin name; the bundle patch mounts this id. */
export const name = 'brave-permission-mode'

/**
 * Required host services.
 *
 * The brave policy installs a guard on the official tool pipeline during
 * startup, so the tools service must be present before apply() runs.
 */
export const inject = ['tools']

/** Official permission preset key that activates this policy. */
export const BRAVE_PERMISSION_PRESET = 'brave'

/** Host policy configuration. */
export interface Config {
  /** Permission-preset key that activates this policy. */
  readonly presetName?: string
  /**
   * Extra writable roots beyond the workspace — the「勇者领域」(brave domain)
   * where routine reads/edits are allowed automatically. Relative entries
   * resolve against the workspace.
   */
  readonly braveRoots?: string[]
  /** Deletion of existing data outside the brave domain: allow/ask/deny. Default `allow`. */
  readonly deleteOutside?: 'allow' | 'ask' | 'deny'
  /** External-write tools (deploy/publish/push/…): ask or deny. Default `ask`. */
  readonly externalWrite?: 'ask' | 'deny'
  readonly workspaceRoot?: string
  readonly dshHome?: string
  readonly tempRoots?: string[]
}

export const Config: Schema<Config> = Schema.object({
  presetName: Schema.string().default(BRAVE_PERMISSION_PRESET),
  braveRoots: Schema.array(Schema.string()).default([]).description(
    '勇者领域：工作区之外允许自由读写的目录（如 G:\\CodeRep、~/.dsh）。',
  ),
  deleteOutside: Schema.union(['allow', 'ask', 'deny']).default('allow').description(
    '勇者领域之外的既有数据删除策略：allow 放行（回收站纪律兜底），ask 需老师确认，deny 直接拒绝。',
  ),
  externalWrite: Schema.union(['ask', 'deny']).default('ask').description(
    '外部写入（deploy/publish/push 等）：ask 需老师确认，deny 直接拒绝。',
  ),
  workspaceRoot: Schema.string(),
  dshHome: Schema.string(),
  tempRoots: Schema.array(Schema.string()),
})

/** Whether the pending tool call belongs to a session currently using the brave preset. */
export function isBravePermissionExecution(exec: Readonly<ToolExecution>, presetName = BRAVE_PERMISSION_PRESET): boolean {
  const events = exec.agent?.session.events
  return events !== undefined && effectivePermissionPreset(events) === presetName
}

type ParentSessionId = NonNullable<NonNullable<ToolExecution['agent']>['session']['header']['parentSession']>

interface ParentAgentLookup {
  (sessionId: ParentSessionId): ToolExecution['agent'] | undefined
}

/**
 * Brave is a session capability, so official in-process subagents inherit it
 * through their durable parentSession lineage. DSH pins child approval to
 * `never`, so an `ask` under a child resolves as a denial — the child must
 * report the limitation to its parent instead of bypassing the policy.
 */
export function braveAuthority(
  exec: Readonly<ToolExecution>,
  parentAgent: ParentAgentLookup,
  presetName = BRAVE_PERMISSION_PRESET,
): ToolExecution['agent'] | undefined {
  if (isBravePermissionExecution(exec, presetName)) return exec.agent
  let session = exec.agent?.session
  const visited = new Set<string>()
  while (session?.header?.origin === 'subagent' && session.header.parentSession !== undefined) {
    const parentSessionId = session.header.parentSession
    const parentKey = String(parentSessionId)
    if (visited.has(parentKey)) return undefined
    visited.add(parentKey)
    const parent = parentAgent(parentSessionId)
    if (parent === undefined) return undefined
    const parentExec = { ...exec, agent: parent }
    if (isBravePermissionExecution(parentExec, presetName)) return parent
    session = parent.session
  }
  return undefined
}

/** Install the brave permission policy on the official tool pipeline. */
export function apply(ctx: Context, config: Config = {}): void {
  const artifacts = new ArtifactRegistry()
  const presetName = config.presetName ?? BRAVE_PERMISSION_PRESET
  const rootOptions: RootOptions = {
    ...(config.workspaceRoot === undefined ? {} : { workspaceRoot: config.workspaceRoot }),
    ...(config.dshHome === undefined ? {} : { dshHome: config.dshHome }),
    ...(config.tempRoots === undefined ? {} : { tempRoots: config.tempRoots }),
    ...(config.braveRoots === undefined ? {} : { braveRoots: config.braveRoots }),
  }
  const rootsFor = (exec: Readonly<ToolExecution>): PolicyRoots => resolveRoots(exec.agent?.session.header.cwd, rootOptions)
  const parentAgent: ParentAgentLookup = sessionId => ctx.get('agents')?.get(sessionId)
  const authorityFor = (exec: Readonly<ToolExecution>): ToolExecution['agent'] | undefined => braveAuthority(
    exec, parentAgent, presetName,
  )
  const isBraveExecution = (exec: Readonly<ToolExecution>): boolean => authorityFor(exec) !== undefined

  ctx.tools.guard((exec) => isBraveExecution(exec) ? hardDenyReason(exec, rootsFor(exec)) : undefined)
  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    if (!isBraveExecution(exec)) return next()
    const roots = rootsFor(exec)
    const assessment = assessTool(exec, roots, artifacts, {
      deleteOutside: config.deleteOutside ?? 'allow',
      externalWrite: config.externalWrite ?? 'ask',
    })
    if (assessment.plannedCreates !== undefined) artifacts.plan(exec, assessment.plannedCreates, roots)
    if (assessment.decision === 'deny') return { kind: 'deny', reason: `[brave hard deny] ${assessment.reason}` }
    if (assessment.decision === 'allow') return next()
    return { kind: 'ask', reason: `[brave approval required] ${assessment.reason}` }
  })
  ctx.on('tools/result', (exec, result) => {
    if (!isBraveExecution(exec)) return
    artifacts.settle(exec, result, rootsFor(exec))
  })
}
