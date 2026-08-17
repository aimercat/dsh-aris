import type { ClientContext, ConversationSnapshot, ISessions, ObservableSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { isArisAvatarClientConfig, isArisAvatarProjection } from '../../live2d/types.ts'
import { resolveCollapsedAvatarUrl } from './collapsed-avatar.ts'
import { createOverlay } from './overlay.ts'
import { Live2DAvatarRuntime } from './runtime.ts'
import { defaultState, loadState, saveState, type Live2DLocalState, type Live2DStateDefaults } from './state.ts'

const LIVE2D_SETTINGS_NAMESPACE = 'aris-live2d'

interface Live2DSettingsSection {
  enabled?: boolean
  muted?: boolean
  allowMotionSound?: boolean
  defaultHidden?: boolean
}

function sessionsPort(ctx: ClientContext): ISessions {
  return ctx.sessions as unknown as ISessions
}

function sessionList(ctx: ClientContext): ObservableSnapshot<{ current: SessionId | undefined }> {
  return sessionsPort(ctx).list as unknown as ObservableSnapshot<{ current: SessionId | undefined }>
}

export function createLive2DBridge(ctx: ClientContext): { sync: (enabled: boolean) => void; stop: () => void } {
  const binder = ctx.get('webUiSettings') ?? ctx.get('settingsScope')
  const live2dSettings = binder?.bind<Live2DSettingsSection>({ namespace: LIVE2D_SETTINGS_NAMESPACE }) ?? {
    getSnapshot: () => ({ status: 'pending' as const }),
    subscribe: () => (() => {}),
  }

  let active = false
  let currentSessionId: SessionId | undefined
  let localState: Live2DLocalState | undefined
  let overlay: ReturnType<typeof createOverlay> | undefined
  let runtime: Live2DAvatarRuntime | undefined
  let disposeConfig: (() => void) | undefined
  let disposeProjection: (() => void) | undefined
  let disposeSession: (() => void) | undefined
  let disposeSettings: (() => void) | undefined
  let retryTimer: number | undefined
  let lastIntentId: string | undefined
  let lastRunning = false
  let lastError: string | null = null
  let greetedSession: SessionId | undefined

  const teardownRuntime = (): void => {
    runtime?.destroy()
    runtime = undefined
    overlay?.destroy()
    overlay = undefined
  }

  const teardownSession = (): void => {
    disposeConfig?.()
    disposeConfig = undefined
    disposeProjection?.()
    disposeProjection = undefined
    disposeSession?.()
    disposeSession = undefined
    disposeSettings?.()
    disposeSettings = undefined
    teardownRuntime()
    currentSessionId = undefined
    if (retryTimer !== undefined) {
      window.clearTimeout(retryTimer)
      retryTimer = undefined
    }
    lastIntentId = undefined
    lastRunning = false
    lastError = null
  }

  const bindSession = (sessionId: SessionId): void => {
    const binding = sessionsPort(ctx).binding(sessionId)
    if (binding === undefined) {
      if (retryTimer === undefined) {
        retryTimer = window.setTimeout(() => {
          retryTimer = undefined
          if (active) controller.sync(true)
        }, 150)
      }
      return
    }
    currentSessionId = sessionId

    const configFace = binding.session.projections.faceOf('arisAvatarConfig') as ObservableSnapshot<unknown>
    const projectionFace = binding.session.projections.faceOf('arisAvatar') as ObservableSnapshot<unknown>

    const currentConfig = () => {
      const value = configFace.getSnapshot()
      if (!isArisAvatarClientConfig(value) || !value.enabled || value.modelBase.trim() === '') {
        return null
      }

      const settingsSnapshot = live2dSettings.getSnapshot()
      const settings = settingsSnapshot.status === 'ready' ? settingsSnapshot.value : undefined
      if (typeof settings?.enabled === 'boolean' && !settings.enabled) return null

      return {
        ...value,
        muted: typeof settings?.muted === 'boolean' ? settings.muted : value.muted,
        allowMotionSound: typeof settings?.allowMotionSound === 'boolean' ? settings.allowMotionSound : value.allowMotionSound,
        defaultHidden: typeof settings?.defaultHidden === 'boolean' ? settings.defaultHidden : value.defaultHidden,
      }
    }

    const ensureRuntime = (): void => {
      const value = currentConfig()
      if (value === null) {
        teardownRuntime()
        return
      }

      const collapsedAvatarUrl = resolveCollapsedAvatarUrl()
      const stateDefaults: Live2DStateDefaults = {
        scale: value.scale,
        hidden: value.defaultHidden,
      }

      if (overlay !== undefined || runtime !== undefined) {
        overlay?.setCollapsedAvatarUrl(collapsedAvatarUrl)
        runtime?.setMotionSoundEnabled(value.allowMotionSound)
        runtime?.setMuted(value.muted)
        return
      }

      localState = loadState(value.anchor, stateDefaults)
      overlay = createOverlay(document, localState, () => defaultState(value.anchor, stateDefaults), (next) => {
        localState = next
        saveState(next)
        runtime?.setScale(next.scale)
      })
      overlay.setCollapsedAvatarUrl(collapsedAvatarUrl)
      runtime = new Live2DAvatarRuntime(overlay, {
        modelBase: value.modelBase,
        cubismCoreUrl: value.cubismCoreUrl,
        scale: localState.scale,
        followPointer: value.followPointer,
        muted: value.muted,
        allowMotionSound: value.allowMotionSound,
      })
      void runtime.init().catch((error) => {
        console.warn('[dsh-aris] live2d init failed:', error)
        if (overlay !== undefined) {
          overlay.stage.setAttribute('data-stage-state', 'failed')
          overlay.stage.textContent = `Live2D load failed: ${String(error instanceof Error ? error.message : error)}`.slice(0, 120)
        }
        overlay?.setBubble(`Live2D load failed: ${String(error instanceof Error ? error.message : error)}`.slice(0, 96), 'warning')
      })
    }

    const projectionSync = (): void => {
      ensureRuntime()
      const value = projectionFace.getSnapshot()
      if (!isArisAvatarProjection(value) || value.intentId === lastIntentId) return
      lastIntentId = value.intentId
      void runtime?.applyIntent(value.intent)
    }

    const sessionSync = (): void => {
      ensureRuntime()
      const snapshot = binding.session.getSnapshot() as ConversationSnapshot
      if (greetedSession !== sessionId) {
        greetedSession = sessionId
        void runtime?.performSemantic('greeting')
      }
      if (!lastRunning && snapshot.running) void runtime?.performSemantic('thinking')
      if (lastRunning && !snapshot.running && snapshot.lastAgentError === null) void runtime?.performSemantic('victory')
      lastRunning = snapshot.running
      if (snapshot.lastAgentError !== lastError && snapshot.lastAgentError !== null) {
        void runtime?.performSemantic('warning')
        runtime?.showBubble(snapshot.lastAgentError.slice(0, 60), 'warning', 2600)
      }
      lastError = snapshot.lastAgentError
    }

    const configSync = (): void => {
      ensureRuntime()
      projectionSync()
      sessionSync()
    }

    configSync()
    disposeConfig = configFace.subscribe(configSync)
    disposeProjection = projectionFace.subscribe(projectionSync)
    disposeSession = binding.session.subscribe(sessionSync)
    disposeSettings = live2dSettings.subscribe(configSync)
  }

  const controller = {
    sync(enabled: boolean) {
      active = enabled
      const sessionId = sessionList(ctx).getSnapshot().current
      if (!active || sessionId === undefined) {
        teardownSession()
        return
      }
      if (currentSessionId === sessionId) return
      teardownSession()
      bindSession(sessionId)
    },
    stop() {
      active = false
      teardownSession()
    },
  }

  return controller
}
