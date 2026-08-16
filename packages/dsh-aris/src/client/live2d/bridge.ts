import type { ClientContext, ConversationSnapshot, ISessions, ObservableSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { isArisAvatarClientConfig, isArisAvatarProjection } from '../../live2d/types.ts'
import { createOverlay } from './overlay.ts'
import { Live2DAvatarRuntime } from './runtime.ts'
import { loadState, saveState, type Live2DLocalState } from './state.ts'

function sessionsPort(ctx: ClientContext): ISessions {
  return ctx.sessions as unknown as ISessions
}

function sessionList(ctx: ClientContext): ObservableSnapshot<{ current: SessionId | undefined }> {
  return sessionsPort(ctx).list as unknown as ObservableSnapshot<{ current: SessionId | undefined }>
}

export function createLive2DBridge(ctx: ClientContext): { sync: (enabled: boolean) => void; stop: () => void } {
  let active = false
  let currentSessionId: SessionId | undefined
  let localState: Live2DLocalState | undefined
  let overlay: ReturnType<typeof createOverlay> | undefined
  let runtime: Live2DAvatarRuntime | undefined
  let disposeConfig: (() => void) | undefined
  let disposeProjection: (() => void) | undefined
  let disposeSession: (() => void) | undefined
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

    const ensureRuntime = (): void => {
      const value = configFace.getSnapshot()
      if (!isArisAvatarClientConfig(value) || !value.enabled || value.modelBase.trim() === '') {
        teardownRuntime()
        return
      }
      if (overlay !== undefined || runtime !== undefined) return

      localState = loadState(value.anchor)
      overlay = createOverlay(document, localState, (next) => {
        localState = next
        saveState(next)
        runtime?.setScale(next.scale)
      })
      runtime = new Live2DAvatarRuntime(overlay, {
        modelBase: value.modelBase,
        cubismCoreUrl: value.cubismCoreUrl,
        scale: localState.scale,
        followPointer: value.followPointer,
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
