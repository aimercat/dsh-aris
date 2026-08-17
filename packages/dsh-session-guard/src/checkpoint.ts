/**
 * Module C — failure checkpoint archive.
 *
 * When a context-overflow failure reaches the user (the host's single
 * overflow-recovery retry failed or the overflow happened mid-turn), the
 * guard archives a compact handoff document next to the workspace, so the
 * work can be resumed later without replaying the whole history (Codex
 * resume philosophy).
 *
 * @module @aimercat/dsh-session-guard/checkpoint
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { CheckpointConfig, GuardSessionLike } from './types.ts'

/** How many trailing messages the checkpoint previews. */
const PREVIEW_MESSAGE_COUNT = 24
/** Per-message preview budget. */
const PREVIEW_CHAR_LIMIT = 240

/** Derive a one-line text preview from a derived message. */
export function previewMessage(message: { role?: string; content?: readonly { type?: string; text?: string }[] }): string {
  const text = (message.content ?? [])
    .filter((block) => block.type === 'text' && block.text !== undefined)
    .map((block) => block.text as string)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  const clipped = text.length > PREVIEW_CHAR_LIMIT ? `${text.slice(0, PREVIEW_CHAR_LIMIT)}…` : text
  const role = message.role ?? '?'
  return `- [${role}] ${clipped || '(no text)'}`
}

/**
 * Write one failure checkpoint document for the session.
 * @param session - the session that failed with context overflow.
 * @param turn - the turn that failed.
 * @param failureMessage - provider error text, when available.
 * @param config - resolved checkpoint configuration.
 * @param workspaceRoot - directory the checkpoint dir is resolved under.
 * @returns the written file path, or `null` when the session exposes nothing usable.
 */
export async function writeFailureCheckpoint(
  session: GuardSessionLike,
  turn: number,
  failureMessage: string,
  config: CheckpointConfig,
  workspaceRoot = process.cwd(),
): Promise<string | null> {
  if (!config.enabled) return null
  // resolve() (not join) so an absolute configured dir overrides the root.
  const dir = resolve(workspaceRoot, config.dir, 'checkpoints')
  await mkdir(dir, { recursive: true })
  const messages = (session.deriveMessages?.() ?? []) as Array<{ role?: string; content?: readonly { type?: string; text?: string }[] }>
  const previews = messages.slice(-PREVIEW_MESSAGE_COUNT).map(previewMessage)
  const body = [
    '# 会话存档（上下文溢出）',
    '',
    `- 会话：\`${session.id}\``,
    `- 失败回合：${turn}`,
    `- 时间：${new Date().toISOString()}`,
    `- 失败原因：\`${failureMessage || 'context window exceeded'}\``,
    '',
    '## 最近上下文',
    '',
    ...(previews.length > 0 ? previews : ['- (无消息预览)']),
    '',
    '## 续接建议',
    '',
    '- 使用上面的会话信息继续任务；若需要完整历史，从会话日志恢复。',
    '',
  ].join('\n')
  const file = resolve(dir, `${sanitize(session.id)}-turn-${turn}.md`)
  await writeFile(file, body, 'utf8')
  return file
}

/** Keep file names safe from arbitrary session ids. */
function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}
