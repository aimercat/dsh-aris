import { describe, expect, it } from 'vitest'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import {
  buildPromptIndex,
  extractPromptText,
  formatPromptTime,
  summarizePrompt,
} from '../src/client/prompt-nav/index.ts'

/** Minimal chat render node shaped like the official input-message output. */
function node(key: string, kind: string, data: unknown) {
  return { key, kind, id: `id-${key}`, target: 'chat', anchorSeq: 1, location: { kind: 'session' }, visibility: 'visible', data }
}

function chatOf(keys: string[], nodes: Record<string, unknown>): ChatSnapshot {
  return {
    order: keys,
    nodes: { get: (key: string) => nodes[key] },
    locations: {},
    timeline: {},
    legacy: { nodes: [], turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [] },
  } as unknown as ChatSnapshot
}

function userData(time: number, text: string, kind: 'user' | 'steering' = 'user') {
  return { kind, seq: time, time, content: [{ type: 'text', text }], source: { kind: 'user' } }
}

describe('buildPromptIndex', () => {
  it('collects user and steering nodes in chat order', () => {
    const nodes = {
      '13:input-message<a>': node('13:input-message<a>', 'user', userData(1000, '你好，爱丽丝')),
      '16:assistant-message<b>': node('16:assistant-message<b>', 'assistant', { kind: 'assistant' }),
      '13:input-message<c>': node('13:input-message<c>', 'steering', userData(2000, '停一下，先看日志', 'steering')),
      '13:input-message<d>': node('13:input-message<d>', 'context', { kind: 'context' }),
      '11:tool-result<e>': node('11:tool-result<e>', 'tool-result', { kind: 'tool-result' }),
    }
    const index = buildPromptIndex(chatOf(['13:input-message<a>', '16:assistant-message<b>', '13:input-message<c>', '13:input-message<d>', '11:tool-result<e>'], nodes))

    expect(index).toHaveLength(2)
    expect(index[0]).toMatchObject({ key: '13:input-message<a>', kind: 'user', time: 1000 })
    expect(index[1]).toMatchObject({ key: '13:input-message<c>', kind: 'steering', time: 2000 })
    expect(index[1].preview).toBe('停一下，先看日志')
  })

  it('skips nodes missing from the store (window cut)', () => {
    const nodes = {
      '13:input-message<a>': node('13:input-message<a>', 'user', userData(1000, '第一句')),
    }
    const index = buildPromptIndex(chatOf(['13:input-message<a>', '13:input-message<ghost>'], nodes))
    expect(index).toHaveLength(1)
  })

  it('skips malformed user nodes without numeric time', () => {
    const nodes = {
      '13:input-message<a>': node('13:input-message<a>', 'user', { kind: 'user' }),
    }
    const index = buildPromptIndex(chatOf(['13:input-message<a>'], nodes))
    expect(index).toEqual([])
  })

  it('uses the node key as the anchor key', () => {
    const nodes = {
      '13:input-message<a>': node('13:input-message<a>', 'user', userData(1, 'x')),
    }
    const index = buildPromptIndex(chatOf(['13:input-message<a>'], nodes))
    expect(index[0].key).toBe('13:input-message<a>')
  })
})

describe('extractPromptText', () => {
  it('concatenates text blocks and ignores non-text blocks', () => {
    const content = [
      { type: 'text', text: '第一段' },
      { type: 'tool_use', id: 't1', name: 'read', arguments: {} },
      { type: 'text', text: '第二段' },
    ]
    expect(extractPromptText(content)).toBe('第一段第二段')
  })

  it('returns an empty string for empty content', () => {
    expect(extractPromptText([])).toBe('')
  })
})

describe('summarizePrompt', () => {
  it('truncates long first lines with an ellipsis', () => {
    const long = 'x'.repeat(100)
    const preview = summarizePrompt(long, 56)
    expect(preview).toHaveLength(57)
    expect(preview.endsWith('…')).toBe(true)
  })

  it('keeps short lines intact', () => {
    expect(summarizePrompt('  邦邦卡邦！  ')).toBe('邦邦卡邦！')
  })

  it('takes only the first line', () => {
    expect(summarizePrompt('第一行\n第二行')).toBe('第一行')
  })

  it('labels empty messages', () => {
    expect(summarizePrompt('\n  \n')).toBe('（空消息）')
  })
})

describe('formatPromptTime', () => {
  const now = new Date(2026, 7, 17, 15, 0, 0).getTime()

  it('formats today as HH:MM', () => {
    const time = new Date(2026, 7, 17, 9, 5).getTime()
    expect(formatPromptTime(time, now)).toBe('09:05')
  })

  it('formats other days as M/D HH:MM', () => {
    const time = new Date(2026, 6, 30, 23, 59).getTime()
    expect(formatPromptTime(time, now)).toBe('7/30 23:59')
  })
})
