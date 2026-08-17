import type { Live2DLocalState } from './state.ts'
import { normalizeState } from './state.ts'

export const ROOT_ID = 'dsh-aris-live2d-root'
export const ROOT_ATTR = 'data-dsh-aris-live2d'
export const STAGE_CLASS = 'aris-live2d-stage'
export const BUBBLE_CLASS = 'aris-live2d-bubble'
export const TOGGLE_CLASS = 'aris-live2d-toggle'
export const RESET_CLASS = 'aris-live2d-reset'

export interface Live2DOverlay {
  readonly root: HTMLDivElement
  readonly stage: HTMLDivElement
  readonly bubble: HTMLDivElement
  readonly toggle: HTMLButtonElement
  readonly reset: HTMLButtonElement
  setState(state: Live2DLocalState): void
  setCollapsedAvatarUrl(url: string): void
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

  root.append(toggle, reset, bubble, stage)
  doc.body.appendChild(root)

  let state = normalizeState(initialState, initialState.anchor, {
    scale: initialState.scale,
    hidden: initialState.hidden,
  })
  let dragging = false
  let dragOffsetX = 0
  let dragOffsetY = 0
  let dragStartX = 0
  let dragStartY = 0
  let dragMoved = false
  let gestureFromCollapsedToggle = false
  let suppressToggleClick = false

  const DRAG_START_THRESHOLD = 4

  const apply = (): void => {
    root.style.left = `${state.left}px`
    root.style.top = `${state.top}px`
    root.dataset.hidden = state.hidden ? '1' : '0'
    root.style.setProperty('--aris-live2d-scale', `${state.scale}`)
    toggle.textContent = state.hidden ? '' : '×'
    toggle.title = state.hidden ? '展开爱丽丝' : '收起爱丽丝'
    toggle.setAttribute('aria-label', toggle.title)
  }

  const commit = (): void => {
    state = normalizeState(state, state.anchor, {
      scale: state.scale,
      hidden: state.hidden,
    })
    onState({ ...state })
    apply()
  }

  const finishDrag = (): void => {
    if (!dragging) return
    const moved = dragMoved
    const fromCollapsedToggle = gestureFromCollapsedToggle
    dragging = false
    dragMoved = false
    gestureFromCollapsedToggle = false

    if (fromCollapsedToggle && !moved) {
      suppressToggleClick = true
      state.hidden = false
      commit()
      return
    }

    if (moved) {
      if (fromCollapsedToggle) suppressToggleClick = true
      commit()
    }
  }

  const onToggleClick = (event: MouseEvent): void => {
    event.stopPropagation()
    if (suppressToggleClick) {
      suppressToggleClick = false
      event.preventDefault()
      return
    }
    state.hidden = !state.hidden
    commit()
  }

  const onResetClick = (event: MouseEvent): void => {
    event.stopPropagation()
    state = resolveDefaultState()
    commit()
  }

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target as Element | null
    const onButton = target?.closest('button') !== null
    const onCollapsedToggle = state.hidden && target?.closest(`.${TOGGLE_CLASS}`) !== null
    if (onButton && !onCollapsedToggle) return
    dragging = true
    dragOffsetX = event.clientX - state.left
    dragOffsetY = event.clientY - state.top
    dragStartX = event.clientX
    dragStartY = event.clientY
    dragMoved = false
    gestureFromCollapsedToggle = onCollapsedToggle
    root.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) return
    const deltaX = event.clientX - dragStartX
    const deltaY = event.clientY - dragStartY
    if (!dragMoved) {
      if (Math.hypot(deltaX, deltaY) < DRAG_START_THRESHOLD) return
      dragMoved = true
    }
    state = normalizeState({
      ...state,
      left: event.clientX - dragOffsetX,
      top: event.clientY - dragOffsetY,
    }, state.anchor, {
      scale: state.scale,
      hidden: state.hidden,
    })
    apply()
  }

  const onViewportChange = (): void => {
    const next = normalizeState(state, state.anchor, {
      scale: state.scale,
      hidden: state.hidden,
    })
    if (
      next.left === state.left &&
      next.top === state.top &&
      next.scale === state.scale &&
      next.hidden === state.hidden &&
      next.anchor === state.anchor
    ) {
      apply()
      return
    }
    state = next
    commit()
  }

  toggle.addEventListener('click', onToggleClick)
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
    reset,
    setState(next) {
      state = normalizeState(next, next.anchor, {
        scale: next.scale,
        hidden: next.hidden,
      })
      apply()
    },
    setCollapsedAvatarUrl(url) {
      root.style.setProperty('--aris-live2d-collapsed-avatar', url)
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
