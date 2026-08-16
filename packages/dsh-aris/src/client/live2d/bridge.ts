import type { ClientContext, ConversationSnapshot, ISessions, ObservableSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { Config as ArisConfig } from '../../index.ts'
import { isArisAvatarProjection } from '../../live2d/types.ts'
import { createOverlay } from './overlay.ts'
import { Live2DAvatarRuntime } from './runtime.ts'
import { loadState, saveState, type Live2DLocalState } from './state.ts'

function sessionsPort(ctx: ClientContext): ISessions {
  return ctx.sessions as unknown as ISessions
}

function sessionList(ctx: ClientContext): ObservableSnapshot<{ current: SessionId | undefined }> {
  return sessionsPort(ctx).list as unknown as ObservableSnapshot<{ current: SessionId | undefined }>
}

export function createLive2DBridge(ctx: ClientContext, config: Partial<ArisConfig> = {}): { sync: (enabled: boolean) => void; stop: () => void } {
  let active = false
  let currentSessionId: SessionId | undefined
  let localState: Live2DLocalState | undefined
  let overlay: ReturnType<typeof createOverlay> | undefined
  let runtime: Live2DAvatarRuntime | undefined
  let disposeProjection: (() => void) | undefined
  let disposeSession: (() => void) | undefined
  let retryTimer: number | undefined
  let lastIntentId: string | undefined
  let lastRunning = false
  let lastError: string | null = null
  let greetedSession: SessionId | undefined

  const modelBase = config.live2dModelBase?.trim() ?? ''
  const canRender = (config.live2dEnabled ?? false) && modelBase !== ''

  const teardownSession = (): void => {
    disposeProjection?.()
    disposeProjection = undefined
    disposeSession?.()
    disposeSession = undefined
    runtime?.destroy()
    runtime = undefined
    overlay?.destroy()
    overlay = undefined
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
    localState = loadState(config.live2dAnchor ?? 'bottom-right')
    overlay = createOverlay(document, localState, (next) => {
      localState = next
      saveState(next)
      runtime?.setScale(next.scale)
    })
    runtime = new Live2DAvatarRuntime(overlay, {
      modelBase,
      cubismCoreUrl: config.live2dCubismCoreUrl?.trim() ?? 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
      scale: localState.scale,
      followPointer: config.live2dFollowPointer ?? false,
    })
    void runtime.init().catch((error) => {
      console.warn('[dsh-aris] live2d init failed:', error)
      overlay?.setBubble(`Live2D load failed: ${String(error instanceof Error ? error.message : error)}`.slice(0, 96), 'warning')
    })

    const projectionFace = binding.session.projections.faceOf('arisAvatar') as ObservableSnapshot<unknown>
    const projectionSync = (): void => {
      const value = projectionFace.getSnapshot()
      if (!isArisAvatarProjection(value) || value.intentId === lastIntentId) return
      lastIntentId = value.intentId
      void runtime?.applyIntent(value.intent)
    }
    projectionSync()
    disposeProjection = projectionFace.subscribe(projectionSync)

    const sessionSync = (): void => {
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
    sessionSync()
    disposeSession = binding.session.subscribe(sessionSync)
  }

  const controller = {
    sync(enabled: boolean) {
      active = enabled && canRender
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
