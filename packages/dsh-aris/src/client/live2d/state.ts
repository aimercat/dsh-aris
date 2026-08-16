import type { ArisAvatarAnchor } from '../../live2d/types.ts'

export const STORAGE_KEY = 'dsh-aris-live2d-state-v2'
export const STAGE_WIDTH = 320
export const STAGE_HEIGHT = 420

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

export function defaultState(anchor: ArisAvatarAnchor): Live2DLocalState {
  const width = typeof window === 'undefined' ? 1280 : window.innerWidth
  const height = typeof window === 'undefined' ? 720 : window.innerHeight
  const left = anchor === 'bottom-left' ? 24 : Math.max(24, width - STAGE_WIDTH - 24)
  const top = Math.max(24, height - STAGE_HEIGHT - 24)
  return { left, top, scale: 1, hidden: false, anchor }
}

export function normalizeState(candidate: Partial<Live2DLocalState> | undefined, fallbackAnchor: ArisAvatarAnchor): Live2DLocalState {
  const fallback = defaultState(fallbackAnchor)
  const width = typeof window === 'undefined' ? 1280 : window.innerWidth
  const height = typeof window === 'undefined' ? 720 : window.innerHeight
  const maxLeft = Math.max(12, width - 80)
  const maxTop = Math.max(12, height - 80)
  return {
    left: clamp(candidate?.left ?? fallback.left, 12, maxLeft),
    top: clamp(candidate?.top ?? fallback.top, 12, maxTop),
    scale: clamp(candidate?.scale ?? fallback.scale, 0.45, 1.6),
    hidden: candidate?.hidden ?? fallback.hidden,
    anchor: candidate?.anchor ?? fallback.anchor,
  }
}

export function loadState(anchor: ArisAvatarAnchor): Live2DLocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return defaultState(anchor)
    const parsed = JSON.parse(raw) as Partial<Live2DLocalState>
    return normalizeState(parsed, anchor)
  } catch {
    return defaultState(anchor)
  }
}

export function saveState(state: Live2DLocalState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore persistence failures.
  }
}
