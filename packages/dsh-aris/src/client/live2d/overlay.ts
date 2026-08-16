import type { Live2DLocalState } from './state.ts'
import { normalizeState } from './state.ts'

export const ROOT_ID = 'dsh-aris-live2d-root'
export const ROOT_ATTR = 'data-dsh-aris-live2d'
export const STAGE_CLASS = 'aris-live2d-stage'
export const BUBBLE_CLASS = 'aris-live2d-bubble'
export const TOGGLE_CLASS = 'aris-live2d-toggle'
export const MUTE_CLASS = 'aris-live2d-mute'
export const RESET_CLASS = 'aris-live2d-reset'

export interface Live2DOverlay {
  readonly root: HTMLDivElement
  readonly stage: HTMLDivElement
  readonly bubble: HTMLDivElement
  readonly toggle: HTMLButtonElement
  readonly mute: HTMLButtonElement
  readonly reset: HTMLButtonElement
  setState(state: Live2DLocalState): void
  setBubble(text: string | null, tone: string | undefined): void
  destroy(): void
}

export function createOverlay(
  doc: Document,
  initialState: Live2DLocalState,
  resolveDefaultState: () => Live2DLocalState,
  onState: (state: Live2DLocalState) => void,
): Live2DOverlay {
  const existing = doc.getElementById(ROOT_ID)
  if (existing instanceof HTMLDivElement) existing.remove()

  const root = doc.createElement('div')
  root.id = ROOT_ID
  root.setAttribute(ROOT_ATTR, '')

  const toggle = doc.createElement('button')
  toggle.className = TOGGLE_CLASS
  toggle.type = 'button'
  toggle.title = '显示/隐藏爱丽丝'

  const mute = doc.createElement('button')
  mute.className = MUTE_CLASS
  mute.type = 'button'
  mute.title = '静音/取消静音'

  const reset = doc.createElement('button')
  reset.className = RESET_CLASS
  reset.type = 'button'
  reset.title = '重置位置与状态'
  reset.textContent = '↺'

  const stage = doc.createElement('div')
  stage.className = STAGE_CLASS
  stage.setAttribute('data-stage-state', 'booting')
  stage.textContent = 'Aris Live2D booting...'

  const bubble = doc.createElement('div')
  bubble.className = BUBBLE_CLASS
  bubble.hidden = true

  root.append(toggle, mute, reset, bubble, stage)
  doc.body.appendChild(root)

  let state = normalizeState(initialState, initialState.anchor, {
    scale: initialState.scale,
    hidden: initialState.hidden,
    muted: initialState.muted,
  })
  let dragging = false
  let dragOffsetX = 0
  let dragOffsetY = 0

  const apply = (): void => {
    root.style.left = `${state.left}px`
    root.style.top = `${state.top}px`
    root.dataset.hidden = state.hidden ? '1' : '0'
    root.style.setProperty('--aris-live2d-scale', `${state.scale}`)
    toggle.textContent = state.hidden ? '◉' : '×'
    mute.textContent = state.muted ? '🔇' : '🔊'
  }

  const commit = (): void => {
    state = normalizeState(state, state.anchor, {
      scale: state.scale,
      hidden: state.hidden,
      muted: state.muted,
    })
    onState({ ...state })
    apply()
  }

  const finishDrag = (): void => {
    if (!dragging) return
    dragging = false
    commit()
  }

  const onToggleClick = (event: MouseEvent): void => {
    event.stopPropagation()
    state.hidden = !state.hidden
    commit()
  }

  const onMuteClick = (event: MouseEvent): void => {
    event.stopPropagation()
    state.muted = !state.muted
    commit()
  }

  const onResetClick = (event: MouseEvent): void => {
    event.stopPropagation()
    state = resolveDefaultState()
    commit()
  }

  const onPointerDown = (event: PointerEvent): void => {
    if ((event.target as Element | null)?.closest('button') !== null) return
    dragging = true
    dragOffsetX = event.clientX - state.left
    dragOffsetY = event.clientY - state.top
    root.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    state = normalizeState({
      ...state,
      left: event.clientX - dragOffsetX,
      top: event.clientY - dragOffsetY,
    }, state.anchor, {
      scale: state.scale,
      hidden: state.hidden,
      muted: state.muted,
    })
    apply()
  }

  const onViewportChange = (): void => {
    const next = normalizeState(state, state.anchor, {
      scale: state.scale,
      hidden: state.hidden,
      muted: state.muted,
    })
    if (
      next.left === state.left &&
      next.top === state.top &&
      next.scale === state.scale &&
      next.hidden === state.hidden &&
      next.muted === state.muted &&
      next.anchor === state.anchor
    ) {
      apply()
      return
    }
    state = next
    commit()
  }

  toggle.addEventListener('click', onToggleClick)
  mute.addEventListener('click', onMuteClick)
  reset.addEventListener('click', onResetClick)
  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('pointermove', onPointerMove)
  root.addEventListener('pointerup', finishDrag)
  root.addEventListener('pointercancel', finishDrag)
  root.addEventListener('lostpointercapture', finishDrag)
  window.addEventListener('resize', onViewportChange)
  window.visualViewport?.addEventListener('resize', onViewportChange)

  apply()

  return {
    root,
    stage,
    bubble,
    toggle,
    mute,
    reset,
    setState(next) {
      state = normalizeState(next, next.anchor, {
        scale: next.scale,
        hidden: next.hidden,
        muted: next.muted,
      })
      apply()
    },
    setBubble(text, tone) {
      if (text === null) {
        bubble.hidden = true
        bubble.textContent = ''
        bubble.removeAttribute('data-tone')
        return
      }
      bubble.hidden = false
      bubble.textContent = text
      if (tone !== undefined) bubble.setAttribute('data-tone', tone)
      else bubble.removeAttribute('data-tone')
    },
    destroy() {
      toggle.removeEventListener('click', onToggleClick)
      mute.removeEventListener('click', onMuteClick)
      reset.removeEventListener('click', onResetClick)
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', finishDrag)
      root.removeEventListener('pointercancel', finishDrag)
      root.removeEventListener('lostpointercapture', finishDrag)
      window.removeEventListener('resize', onViewportChange)
      window.visualViewport?.removeEventListener('resize', onViewportChange)
      root.remove()
    },
  }
}
