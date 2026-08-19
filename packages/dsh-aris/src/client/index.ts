/**
 * Aris browser half.
 *
 * Enhances the assistant reasoning disclosure and, when configured, mounts the
 * session-gated Live2D layer for the Aris preset.
 *
 * @module @aimercat/dsh-aris/client
 */

import type { ClientContext, ObservableSnapshot, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createArisThinkEnhancer } from './aris-think.ts'
import { installBravePermissionIcon } from './brave-icon.ts'
import { registerArisLive2DSettingsCard } from './live2d-settings/index.ts'
import { createLive2DBridge } from './live2d/bridge.ts'
import { isArisSession, sessionList } from './preset.ts'
import { PromptNavController } from './prompt-nav/index.ts'
import { registerPromptNavToggle } from './prompt-nav/toggle.tsx'
import { CSS, STYLE_TAG_ID, ACTIVE_ATTR } from './styles.ts'

export const inject = ['sessions', 'slots', 'locale', 'connection', 'remote']

export function apply(ctx: ClientContext): void {
  let styleTag: HTMLStyleElement | undefined = injectStyle()
  registerArisLive2DSettingsCard(ctx)

  let disabled = false
  try {
    disabled = typeof localStorage !== 'undefined' && localStorage.getItem('dsh-aris-disabled') === '1'
  } catch {
    // Storage may be unavailable in odd contexts; continue normally.
  }

  const enhancer = createArisThinkEnhancer()
  const live2d = createLive2DBridge(ctx)
  const promptNav = new PromptNavController(ctx)
  promptNav.attach()
  const disposePromptNavToggle = registerPromptNavToggle(ctx, promptNav)
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
      // Arm the scoped styles: the <style> tag is injected globally (it must
      // survive session switches), but the Aris think/live2d rules only apply
      // under this body attribute, so non-Aris sessions keep stock rendering.
      document.body.setAttribute(ACTIVE_ATTR, '')
      try {
        enhancer.start()
        live2d.sync(true)
      } catch (error) {
        console.warn('[dsh-aris] enhancer start failed:', error)
        live2d.stop()
        document.body.removeAttribute(ACTIVE_ATTR)
        enabled = false
      }
    } else {
      document.body.removeAttribute(ACTIVE_ATTR)
      live2d.stop()
      enhancer.stop()
    }
  }

  ctx.effect(() => {
    if (!disabled) {
      syncEnablement()
    }
    const dispose = disabled ? (() => {}) : sessionList(ctx).subscribe(syncEnablement)
    return () => {
      dispose()
      disposeBraveIcon()
      disposePromptNavToggle()
      promptNav.dispose()
      live2d.stop()
      enhancer.stop()
      removeStyle(styleTag)
      styleTag = undefined
      enabled = false
    }
  }, 'dsh-aris: browser half')
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
