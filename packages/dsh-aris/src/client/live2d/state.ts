import type { ArisAvatarAnchor } from '../../live2d/types.ts'

export const STORAGE_KEY = 'dsh-aris-live2d-state-v2'
export const STAGE_WIDTH = 320
export const STAGE_HEIGHT = 420
export const HIDDEN_WIDTH = 34
export const HIDDEN_HEIGHT = 34
export const VIEWPORT_PADDING = 12

export interface Live2DStateDefaults {
  scale: number
  hidden: boolean
}

export interface Live2DLocalState {
  left: number
  top: number
  scale: number
  hidden: boolean
  anchor: ArisAvatarAnchor
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function viewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1280, height: 720 }
  const visualViewport = window.visualViewport
  if (visualViewport != null) {
    return {
      width: Math.max(window.innerWidth, Math.floor(visualViewport.width)),
      height: Math.max(window.innerHeight, Math.floor(visualViewport.height)),
    }
  }
  return { width: window.innerWidth, height: window.innerHeight }
}

function footprint(scale: number, hidden: boolean): { width: number; height: number } {
  if (hidden) return { width: HIDDEN_WIDTH, height: HIDDEN_HEIGHT }
  return {
    width: Math.round(STAGE_WIDTH * scale),
    height: Math.round(STAGE_HEIGHT * scale),
  }
}

export function defaultState(anchor: ArisAvatarAnchor, defaults: Live2DStateDefaults): Live2DLocalState {
  const { width, height } = viewportSize()
  const size = footprint(defaults.scale, defaults.hidden)
  const left = anchor === 'bottom-left'
    ? 24
    : Math.max(24, width - size.width - 24)
  const top = Math.max(24, height - size.height - 24)
  return {
    left,
    top,
    scale: defaults.scale,
    hidden: defaults.hidden,
    anchor,
  }
}

export function normalizeState(
  candidate: Partial<Live2DLocalState> | undefined,
  fallbackAnchor: ArisAvatarAnchor,
  defaults: Live2DStateDefaults,
): Live2DLocalState {
  const fallback = defaultState(fallbackAnchor, defaults)
  const scale = clamp(candidate?.scale ?? fallback.scale, 0.45, 1.6)
  const hidden = defaults.hidden
  const anchor = candidate?.anchor ?? fallback.anchor
  const { width, height } = viewportSize()
  const size = footprint(scale, hidden)
  const maxLeft = Math.max(VIEWPORT_PADDING, width - size.width - VIEWPORT_PADDING)
  const maxTop = Math.max(VIEWPORT_PADDING, height - size.height - VIEWPORT_PADDING)

  return {
    left: clamp(candidate?.left ?? fallback.left, VIEWPORT_PADDING, maxLeft),
    top: clamp(candidate?.top ?? fallback.top, VIEWPORT_PADDING, maxTop),
    scale,
    hidden,
    anchor,
  }
}

export function loadState(anchor: ArisAvatarAnchor, defaults: Live2DStateDefaults): Live2DLocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return defaultState(anchor, defaults)
    const parsed = JSON.parse(raw) as Partial<Live2DLocalState>
    return normalizeState(parsed, anchor, defaults)
  } catch {
    return defaultState(anchor, defaults)
  }
}

export function saveState(state: Live2DLocalState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore persistence failures.
  }
}
