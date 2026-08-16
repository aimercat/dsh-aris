/**
 * Aris browser half.
 *
 * Enhances the assistant reasoning disclosure and, when configured, mounts the
 * session-gated Live2D layer for the Aris preset.
 *
 * @module @aimercat/dsh-aris/client
 */

import type { ClientContext, ObservableSnapshot, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { Config as ArisConfig } from '../index.ts'
import { createArisThinkEnhancer } from './aris-think.ts'
import { installBravePermissionIcon } from './brave-icon.ts'
import { createLive2DBridge } from './live2d/bridge.ts'
import { CSS, STYLE_TAG_ID } from './styles.ts'

function sessionList(ctx: ClientContext): ObservableSnapshot<SessionListState> {
  return ctx.sessions.list as unknown as ObservableSnapshot<SessionListState>
}

const ARIS_PRESET_ID = 'aris'

export const inject = ['sessions']

export function apply(ctx: ClientContext, config: Partial<ArisConfig> = {}): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('dsh-aris-disabled') === '1') return
  } catch {
    // Storage may be unavailable in odd contexts; continue normally.
  }

  let styleTag: HTMLStyleElement | undefined
  const enhancer = createArisThinkEnhancer()
  const live2d = createLive2DBridge(ctx, config)
  let enabled = false

  const disposeBraveIcon = installBravePermissionIcon(document)

  const syncEnablement = (): void => {
    const next = isArisSession(ctx)
    if (next === enabled) {
      if (enabled) live2d.sync(true)
      return
    }
    enabled = next
    if (enabled) {
      try {
        styleTag = injectStyle()
        enhancer.start()
        live2d.sync(true)
      } catch (error) {
        console.warn('[dsh-aris] enhancer start failed:', error)
        live2d.stop()
        removeStyle(styleTag)
        styleTag = undefined
        enabled = false
      }
    } else {
      live2d.stop()
      enhancer.stop()
      removeStyle(styleTag)
      styleTag = undefined
    }
  }

  ctx.effect(() => {
    syncEnablement()
    const dispose = sessionList(ctx).subscribe(syncEnablement)
    return () => {
      dispose()
      disposeBraveIcon()
      live2d.stop()
      enhancer.stop()
      removeStyle(styleTag)
      styleTag = undefined
      enabled = false
    }
  }, 'dsh-aris: browser half')
}

function isArisSession(ctx: ClientContext): boolean {
  try {
    const snapshot = sessionList(ctx).getSnapshot()
    const sessionId = snapshot.current as string | undefined
    if (sessionId === undefined) return false
    const byId = snapshot.byId as Record<string, { agentPreset?: string } | undefined>
    return byId[sessionId]?.agentPreset === ARIS_PRESET_ID
  } catch (error) {
    console.warn('[dsh-aris] preset gate read failed:', error)
    return false
  }
}

function injectStyle(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_TAG_ID)
  if (existing !== null) return existing as HTMLStyleElement
  const tag = document.createElement('style')
  tag.id = STYLE_TAG_ID
  tag.dataset.plugin = '@aimercat/dsh-aris'
  tag.textContent = CSS
  document.head.appendChild(tag)
  return tag
}

function removeStyle(tag: HTMLStyleElement | undefined): void {
  if (tag !== undefined && tag.isConnected) tag.remove()
}
