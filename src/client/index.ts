/**
 * Aris thinking-display — browser half.
 *
 * Enhances the assistant reasoning disclosure (the "Think" row) with the
 * Aris presentation layer — Chinese title, typewriter caret, folded
 * sections — but ONLY while the active session runs the `aris` preset
 * (session-level isolation: other presets keep the stock rendering).
 *
 * The style tag and DOM observers are created and torn down with the
 * enablement state, so disabling (switching to another preset) leaves no
 * trace in the page. All DOM work is contained in the enhancer; failures
 * degrade the thinking block to its stock form, never the GUI.
 * @module @aimercat/dsh-aris/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { createArisThinkEnhancer } from './aris-think.ts'
import { CSS, STYLE_TAG_ID } from './styles.ts'

/** Preset id this display layer serves. */
const ARIS_PRESET_ID = 'aris'

/** Required services: sessions drives the active-preset gate. */
export const inject = ['sessions']

/** Apply the browser half. */
export function apply(ctx: ClientContext): void {
  // Diagnostic kill switch: set localStorage 'dsh-aris-disabled' = '1' and
  // reload to run the GUI without the Aris enhancer (A/B perf isolation).
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('dsh-aris-disabled') === '1') return
  } catch {
    // Storage may be unavailable in odd contexts; continue normally.
  }
  let styleTag: HTMLStyleElement | undefined
  const enhancer = createArisThinkEnhancer()
  let enabled = false

  /** Toggle the Aris layer for the currently active session. */
  const syncEnablement = (): void => {
    const next = isArisSession(ctx)
    if (next === enabled) return
    enabled = next
    if (enabled) {
      try {
        styleTag = injectStyle()
        enhancer.start()
      } catch (error) {
        // A broken style/observer must not take the GUI down; log and stay off.
        console.warn('[dsh-aris] enhancer start failed:', error)
        removeStyle(styleTag)
        styleTag = undefined
        enabled = false
      }
    } else {
      enhancer.stop()
      removeStyle(styleTag)
      styleTag = undefined
    }
  }

  ctx.effect(() => {
    syncEnablement()
    const dispose = ctx.sessions.list.subscribe(syncEnablement)
    return () => {
      dispose()
      enhancer.stop()
      removeStyle(styleTag)
      styleTag = undefined
      enabled = false
    }
  }, 'dsh-aris: thinking display')
}

/** Whether the currently active session runs the Aris preset. */
function isArisSession(ctx: ClientContext): boolean {
  try {
    const snapshot = ctx.sessions.list.getSnapshot()
    const sessionId = snapshot.current as string | undefined
    if (sessionId === undefined) return false
    const byId = snapshot.byId as Record<string, { agentPreset?: string } | undefined>
    return byId[sessionId]?.agentPreset === ARIS_PRESET_ID
  } catch (error) {
    // Never let a read failure decide enablement loudly.
    console.warn('[dsh-aris] preset gate read failed:', error)
    return false
  }
}

/** Inject the Aris style sheet; returns the tag (for removal). */
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

/** Remove the injected style tag, when present. */
function removeStyle(tag: HTMLStyleElement | undefined): void {
  if (tag !== undefined && tag.isConnected) tag.remove()
}
