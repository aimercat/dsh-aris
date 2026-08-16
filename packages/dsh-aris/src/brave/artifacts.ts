/**
 * Session-artifact registry for the brave permission preset.
 *
 * Adapted from `@nanmicoder/dsh-auto-mode` (MIT, Copyright (c) 2026
 * 程序员阿江-Relakkes): successful creates are recorded per live session so a
 * later EXACT deletion of those paths can be allowed automatically, while
 * pre-session data stays protected. The registry is in-memory and disappears
 * on reload — losing state makes deletion require approval, never broadens
 * access.
 *
 * Provenance keys on the durable session ID, not the session object: the
 * agent loop can hand the policy different session references across turns,
 * so an object-identity key would silently drop prior-turn creates (turning
 * routine cleanup into approval prompts). The id (or header id) is stable for
 * the process lifetime of the session.
 */

import { existsSync } from 'node:fs'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { isArtifactArea, normalizePath, type PolicyRoots } from './paths.js'

interface PendingCreation {
  readonly ownerKey: string
  readonly paths: readonly string[]
}

/** Stable per-session identity for artifact provenance. */
function sessionKeyOf(owner: object | undefined): string | undefined {
  if (owner === undefined) return undefined
  const session = owner as { id?: unknown; header?: { id?: unknown } }
  const id = session.id ?? session.header?.id
  return id === undefined || id === null ? undefined : String(id)
}

/** In-memory provenance for exact paths created successfully during the live session. */
export class ArtifactRegistry {
  private readonly created = new Map<string, Set<string>>()
  private readonly pending = new Map<symbol, PendingCreation>()

  /** Whether a path was observed as created in this exact live session. */
  has(owner: object | undefined, path: string, roots: PolicyRoots): boolean {
    const key = sessionKeyOf(owner)
    if (key === undefined) return false
    const normalized = normalizePath(path, roots.workspace, roots.home)
    return isArtifactArea(normalized, roots) && this.created.get(key)?.has(normalized) === true
  }

  /** Record planned exact creations for settlement-time promotion. */
  plan(exec: ToolExecution, paths: readonly string[], roots: PolicyRoots): void {
    const key = sessionKeyOf(exec.agent?.session)
    if (key === undefined) return
    const eligible = paths
      .map(path => normalizePath(path, roots.workspace, roots.home))
      .filter(path => isArtifactArea(path, roots) && !existsSync(path))
    if (eligible.length > 0) this.pending.set(exec.token, { ownerKey: key, paths: eligible })
  }

  /** Promote successful creates and forget every pending execution. */
  settle(exec: ToolExecution, result: ToolExecutionResult, roots: PolicyRoots): void {
    const key = sessionKeyOf(exec.agent?.session)
    const pending = this.pending.get(exec.token)
    this.pending.delete(exec.token)
    if (key === undefined || result.isError) return
    const value = result.value
    const shellSucceeded = typeof value === 'object' && value !== null
      && 'exitCode' in value && value.exitCode === 0
    if (pending !== undefined && pending.ownerKey === key && shellSucceeded) {
      for (const path of pending.paths) this.add(key, path)
    }
    if (exec.name === 'write' && typeof value === 'object' && value !== null
      && 'operation' in value && value.operation === 'create'
      && 'path' in value && typeof value.path === 'string') {
      const path = normalizePath(value.path, roots.workspace, roots.home)
      if (isArtifactArea(path, roots)) this.add(key, path)
    }
  }

  private add(key: string, path: string): void {
    const paths = this.created.get(key) ?? new Set<string>()
    paths.add(path)
    this.created.set(key, paths)
  }
}
