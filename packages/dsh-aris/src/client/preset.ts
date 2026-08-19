/**
 * Aris preset gate — browser half.
 *
 * Shared by the thinking enhancer and the prompt navigation panel: decides
 * whether the active session runs an Aris preset, and exposes the session
 * list feed in the narrow store shape both consumers need.
 * @module @aimercat/dsh-aris/client/preset
 */

import type { ClientContext, ObservableSnapshot, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'

export const ARIS_PRESET_IDS = new Set(['aris', 'aris-dev'])

/** The session list feed as a bare observable (store-shape cast is the established pattern). */
export function sessionList(ctx: ClientContext): ObservableSnapshot<SessionListState> {
  return ctx.sessions.list as unknown as ObservableSnapshot<SessionListState>
}

/** Whether the currently selected session runs an Aris preset. */
export function isArisSession(ctx: ClientContext): boolean {
  try {
    const snapshot = sessionList(ctx).getSnapshot()
    const sessionId = snapshot.current as string | undefined
    if (sessionId === undefined) return false
    const byId = snapshot.byId as Record<string, { agentPreset?: string } | undefined>
    const preset = byId[sessionId]?.agentPreset
    return preset !== undefined && ARIS_PRESET_IDS.has(preset)
  } catch (error) {
    console.warn('[dsh-aris] preset gate read failed:', error)
    return false
  }
}
