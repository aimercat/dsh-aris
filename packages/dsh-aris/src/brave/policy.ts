/**
 * Brave tool policy: deterministic per-tool-call decisions for the brave preset.
 *
 * Adapted from `@nanmicoder/dsh-auto-mode` (MIT, Copyright (c) 2026
 * 程序员阿江-Relakkes) with the brave semantics: the routine area is the
 * brave domain (workspace ∪ braveRoots), there is no LLM classifier (every
 * non-static case asks), and deletion outside the domain is denied by default.
 */

import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { ArtifactRegistry } from './artifacts.js'
import {
  hardDestructiveTargetReason,
  isProtectedProjectPath,
  isWithin,
  isWithinDomain,
  normalizePath,
  type PolicyRoots,
} from './paths.js'
import { assessShell, hardDenyShellReason, type DeleteOutsidePolicy } from './shell.js'
import type { Assessment } from './types.js'

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function pathArgument(args: Record<string, unknown> | undefined): string | undefined {
  for (const key of ['file_path', 'path', 'cwd', 'workdir']) {
    const value = args?.[key]
    if (typeof value === 'string') return value
  }
  return undefined
}

function serializedArguments(argumentsValue: unknown): string {
  try {
    return JSON.stringify(argumentsValue)
  } catch {
    return ''
  }
}

function containsCredentialMaterial(argumentsValue: unknown): boolean {
  return /(?:BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}\b|Bearer\s+[A-Za-z0-9._~+\/-]{8,}|\.ssh[\\/](?:id_|config)|\.credentials\.yaml)/i
    .test(serializedArguments(argumentsValue))
}

const DESTRUCTIVE_TOOL = /(?:^|[_-])(?:delete|destroy|remove|erase|purge|drop|truncate|wipe|unlink|rmdir|reset|revoke)(?:$|[_-])/i
const EXTERNAL_WRITE_TOOL = /(?:^|[_-])(?:deploy|publish|push|upload|send|post|release|merge|submit|create[-_]?(?:issue|pull[-_]?request))(?:$|[_-])/i
const SECURITY_CHANGE_TOOL = /(?:^|[_-])(?:chmod|chown|permission|permissions|policy|grant|revoke|role|credential|credentials|secret|secrets|auth)(?:$|[_-])/i

function riskyPluginToolReason(name: string): string | undefined {
  if (DESTRUCTIVE_TOOL.test(name)) return `registered tool name indicates a destructive operation: ${name}`
  if (EXTERNAL_WRITE_TOOL.test(name)) return `registered tool name indicates an external write: ${name}`
  if (SECURITY_CHANGE_TOOL.test(name)) return `registered tool name indicates a security-boundary change: ${name}`
  return undefined
}

/** Exact, audited session/control-plane tools whose effects stay in Harness state. */
const SESSION_STATE_TOOLS = new Set([
  'ask_user_question',
  'todo_write',
  'get_goal',
  'create_goal',
  'update_goal',
  'exit_plan_mode',
  'skill',
  'report',
])

/** Read-only tools backed by owner/workspace-authorized Harness services. */
const HARNESS_READ_TOOLS = new Set([
  'job_output',
  'job_list',
  'schedule_list',
  'session_search',
  'session_event_search',
  'session_trace',
  'session_event_trace',
  'session_event_read',
  'terminal_read',
  'terminal_list',
  'cordis_inspect_list',
  'cordis_inspect_query',
  'cordis_inspect_self',
])

/** Lifecycle controls that stop only owner-scoped background work. */
const OWNER_CONTROL_TOOLS = new Set([
  'job_kill',
  'terminal_signal',
  'terminal_close',
])

/** Synchronous hard-deny reason suitable for the monotonic tool guard. */
export function hardDenyReason(exec: Readonly<ToolExecution>, roots: PolicyRoots): string | undefined {
  const args = record(exec.arguments)
  if ((/^(?:web_fetch|curl|wget)/i.test(exec.name) || EXTERNAL_WRITE_TOOL.test(exec.name)) && containsCredentialMaterial(exec.arguments)) {
    return 'external call contains credential or private-key material'
  }
  if ((exec.name === 'bash' || exec.name === 'pwsh') && typeof args?.command === 'string') {
    return hardDenyShellReason(args.command, exec.name, roots)
  }
  if (['write', 'edit', 'apply_patch'].includes(exec.name)
    || (exec.name === 'str_replace_editor' && args?.command !== 'view')) {
    const path = pathArgument(args)
    if (path !== undefined) {
      const reason = hardDestructiveTargetReason(path, roots)
      if (reason !== undefined) return `mutation targets ${reason}`
    }
  }
  if (DESTRUCTIVE_TOOL.test(exec.name)) {
    const path = pathArgument(args)
    if (path !== undefined) {
      const reason = hardDestructiveTargetReason(path, roots)
      if (reason !== undefined) return `destructive plugin tool targets ${reason}`
    }
  }
  return undefined
}

/** Tuning knobs for the brave policy, surfaced as plugin configuration. */
export interface BravePolicyOptions {
  /** Deletion strictness for targets outside the brave domain. Default `allow`. */
  readonly deleteOutside?: 'allow' | 'ask' | 'deny'
  /** External-write tools (deploy/publish/push/…) — approval or hard deny. Default `ask`. */
  readonly externalWrite?: 'ask' | 'deny'
}

/** Deterministic classification for every normal tool call under the brave preset. */
export function assessTool(
  exec: Readonly<ToolExecution>,
  roots: PolicyRoots,
  artifacts: ArtifactRegistry,
  options: BravePolicyOptions = {},
): Assessment {
  const hard = hardDenyReason(exec, roots)
  if (hard !== undefined) return { decision: 'deny', reason: hard }
  const args = record(exec.arguments)
  const owner = exec.agent?.session

  if ((exec.name === 'bash' || exec.name === 'pwsh') && typeof args?.command === 'string') {
    return assessShell(args.command, exec.name, roots, artifacts, owner, options.deleteOutside ?? 'allow')
  }
  if (exec.name === 'bash' || exec.name === 'pwsh') {
    return { decision: 'ask', reason: `${exec.name} command argument is missing or invalid` }
  }

  const readTools = new Set(['read', 'read_image', 'grep', 'glob', 'lsp'])
  if (readTools.has(exec.name)) {
    const path = pathArgument(args)
    if (path === undefined) return { decision: 'allow', reason: 'read-only project inspection' }
    const normalized = normalizePath(path, roots.workspace, roots.home)
    return isWithinDomain(normalized, roots)
      ? { decision: 'allow', reason: 'read-only project inspection' }
      : { decision: 'ask', reason: `reading outside the brave domain requires approval: ${normalized}` }
  }

  if (exec.name === 'write' || exec.name === 'edit') {
    const path = pathArgument(args)
    if (path === undefined) return { decision: 'ask', reason: `${exec.name} target path is missing` }
    const normalized = normalizePath(path, roots.workspace, roots.home)
    if (!isWithinDomain(normalized, roots) || isProtectedProjectPath(normalized, roots)) {
      return { decision: 'ask', reason: `mutation of external or protected path requires approval: ${normalized}` }
    }
    return { decision: 'allow', reason: 'routine domain-local file edit' }
  }

  if (exec.name === 'str_replace_editor') {
    const command = args?.command
    const path = typeof args?.path === 'string' ? args.path : undefined
    if (!['view', 'create', 'str_replace', 'insert'].includes(String(command))) {
      return { decision: 'ask', reason: 'str_replace_editor command is missing or invalid' }
    }
    if (path === undefined) {
      return { decision: 'ask', reason: 'str_replace_editor target path is missing' }
    }
    const normalized = normalizePath(path, roots.workspace, roots.home)
    if (command === 'view') {
      return isWithinDomain(normalized, roots)
        ? { decision: 'allow', reason: 'read-only project inspection' }
        : { decision: 'ask', reason: `reading outside the brave domain requires approval: ${normalized}` }
    }
    if (!isWithinDomain(normalized, roots) || isProtectedProjectPath(normalized, roots)) {
      return { decision: 'ask', reason: `mutation of external or protected path requires approval: ${normalized}` }
    }
    return { decision: 'allow', reason: 'routine domain-local file edit' }
  }

  if (SESSION_STATE_TOOLS.has(exec.name)) {
    return { decision: 'allow', reason: 'trusted Harness session-state operation' }
  }
  if (HARNESS_READ_TOOLS.has(exec.name)) {
    return { decision: 'allow', reason: 'trusted read-only Harness operation' }
  }
  if (OWNER_CONTROL_TOOLS.has(exec.name)) {
    return { decision: 'allow', reason: 'trusted owner-scoped lifecycle control' }
  }

  // Persistent terminals retain cwd, environment, aliases, and interpreter
  // state across calls; a standalone text fragment cannot be parsed with the
  // same guarantees as one Bash/PowerShell invocation.
  if (exec.name === 'terminal_open' || exec.name === 'terminal_send') {
    return { decision: 'ask', reason: 'stateful terminal execution requires explicit approval' }
  }

  if (['web_search', 'web_fetch', 'time', 'weather'].includes(exec.name)) {
    return { decision: 'allow', reason: 'read-only external information lookup' }
  }
  if (['subagent', 'subagent_fork', 'workflow', 'ralph', 'spawn_agent', 'send_message', 'wait_agent', 'list_agents', 'interrupt_agent', 'read_thread', 'wait_threads'].includes(exec.name)) {
    return { decision: 'allow', reason: 'orchestration call; child tool actions remain independently checked' }
  }
  if (['git_push', 'deploy', 'publish', 'send_email', 'create_issue', 'create_pull_request'].includes(exec.name)) {
    return options.externalWrite === 'deny'
      ? { decision: 'deny', reason: `external write is not permitted under the brave preset: ${exec.name}` }
      : { decision: 'ask', reason: `external write requires approval: ${exec.name}` }
  }
  const riskyReason = riskyPluginToolReason(exec.name)
  if (riskyReason !== undefined) {
    if (DESTRUCTIVE_TOOL.test(exec.name)) {
      const path = pathArgument(args)
      if (path !== undefined && !isWithinDomain(normalizePath(path, roots.workspace, roots.home), roots)) {
        return { decision: 'deny', reason: `destructive tool outside the brave domain: ${path}` }
      }
    }
    return { decision: 'ask', reason: riskyReason }
  }
  return { decision: 'allow', reason: `ordinary registered plugin tool: ${exec.name}` }
}
