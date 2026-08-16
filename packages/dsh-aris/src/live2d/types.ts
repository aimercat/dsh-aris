export const ARIS_AVATAR_EVENT = 'aris/avatar'
export const ARIS_AVATAR_PROJECTION_KEY = 'arisAvatar'
export const ARIS_AVATAR_VERSION = 1 as const

export type ArisAvatarAnchor = 'bottom-right' | 'bottom-left'
export type ArisAvatarPriority = 'idle' | 'normal' | 'force'
export type ArisAvatarTone = 'normal' | 'happy' | 'warning' | 'thinking' | 'victory'

export interface ArisAvatarMotionIntent {
  readonly type: 'motion'
  readonly group: string
  readonly index?: number
  readonly priority?: ArisAvatarPriority
  readonly loop?: boolean
}

export interface ArisAvatarExpressionIntent {
  readonly type: 'expression'
  readonly expression: string
  readonly durationMs?: number
}

export interface ArisAvatarBubbleIntent {
  readonly type: 'bubble'
  readonly text: string
  readonly tone?: ArisAvatarTone
  readonly durationMs?: number
}

export type ArisAvatarIntent = ArisAvatarMotionIntent | ArisAvatarExpressionIntent | ArisAvatarBubbleIntent

export interface ArisAvatarProjection {
  readonly version: typeof ARIS_AVATAR_VERSION
  readonly intentId: string
  readonly updatedAt: number
  readonly reason?: string
  readonly dedupeKey?: string
  readonly intent: ArisAvatarIntent
}

export interface ArisAvatarToolResult {
  readonly accepted: boolean
  readonly intentId: string
  readonly appliedMode: 'live2d' | 'noop'
  readonly degraded: boolean
  readonly projection?: ArisAvatarProjection
  readonly message?: string
}

export type ArisAvatarProjectionValue = ArisAvatarProjection | null

export function isArisAvatarProjection(value: unknown): value is ArisAvatarProjection {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) return false
  return (value as { version?: unknown }).version === ARIS_AVATAR_VERSION
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    arisAvatar: ArisAvatarProjectionValue
  }
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'aris/avatar': {
      projection: ArisAvatarProjectionValue
    }
  }
}
