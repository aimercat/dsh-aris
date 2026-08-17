import { describe, expect, it } from 'vitest'
import { buildContinuationMessage, GUARD_PLUGIN_TAG, hasUnclosedToolCalls, maybeContinueTurn, type GuardAgentLike } from './continuation.ts'
import type { GuardSessionLike } from './types.ts'

interface EventInput {
  seq: number
  type: string
  data?: Record<string, unknown>
}

function makeSession(events: EventInput[]): GuardSessionLike {
  const max = Math.max(0, ...events.map((event) => event.seq))
  const slots: Array<EventInput | undefined> = new Array(max + 1)
  for (const event of events) slots[event.seq] = event
  return {
    id: 's-test',
    events: slots as unknown as GuardSessionLike['events'],
    surface: { nodes: events.map((event) => event.seq) },
  }
}

function assistantEvent(seq: number, toolCallIds: string[]): EventInput {
  return {
    seq,
    type: 'assistant/message',
    data: {
      message: {
        content: toolCallIds.length > 0
          ? toolCallIds.map((id) => ({ type: 'tool-call', id }))
          : [{ type: 'text', text: 'hi' }],
      },
    },
  }
}

function toolResultEvent(seq: number, callId: string): EventInput {
  return { seq, type: 'tool/result', data: { message: { source: { callId } } } }
}

describe('hasUnclosedToolCalls', () => {
  it('is false with no assistant message', () => {
    const session = makeSession([
      { seq: 0, type: 'user/message', data: { message: { content: [{ type: 'text', text: 'a' }] } } },
    ])
    expect(hasUnclosedToolCalls(session)).toBe(false)
  })

  it('is false when the last assistant message has no tool calls', () => {
    const session = makeSession([
      { seq: 0, type: 'user/message', data: { message: { content: [{ type: 'text', text: 'a' }] } } },
      assistantEvent(1, []),
    ])
    expect(hasUnclosedToolCalls(session)).toBe(false)
  })

  it('is false when every tool call has a matching result', () => {
    const session = makeSession([
      assistantEvent(0, ['call-1', 'call-2']),
      toolResultEvent(1, 'call-1'),
      toolResultEvent(2, 'call-2'),
    ])
    expect(hasUnclosedToolCalls(session)).toBe(false)
  })

  it('is true when a tool call is never answered', () => {
    const session = makeSession([
      assistantEvent(0, ['call-1', 'call-2']),
      toolResultEvent(1, 'call-1'),
    ])
    expect(hasUnclosedToolCalls(session)).toBe(true)
  })

  it('is true when a user message interrupts before results arrive', () => {
    const session = makeSession([
      assistantEvent(0, ['call-1']),
      { seq: 1, type: 'user/message', data: { message: { content: [{ type: 'text', text: 'wait' }] } } },
    ])
    expect(hasUnclosedToolCalls(session)).toBe(true)
  })

  it('is false for a fully closed pair followed by plain text', () => {
    const session = makeSession([
      assistantEvent(0, ['call-1']),
      toolResultEvent(1, 'call-1'),
      { seq: 2, type: 'user/message', data: { message: { content: [{ type: 'text', text: 'go on' }] } } },
      assistantEvent(3, []),
    ])
    expect(hasUnclosedToolCalls(session)).toBe(false)
  })
})

describe('buildContinuationMessage', () => {
  it('builds a plugin-sourced text user message', () => {
    const message = buildContinuationMessage('resume now', 1)
    const block = message.content[0]
    expect(block.type).toBe('text')
    expect((block as { text: string }).text).toContain('resume now')
    expect(message.source).toEqual({ kind: 'plugin', plugin: GUARD_PLUGIN_TAG })
  })

  it('appends an attempt suffix after the first attempt', () => {
    const message = buildContinuationMessage('resume now', 2)
    const block = message.content[0]
    expect((block as { text: string }).text).toContain('Continuation attempt 2')
  })
})

describe('maybeContinueTurn', () => {
  function makeAgent(session: GuardSessionLike, followup: (message: unknown) => void): GuardAgentLike {
    return { session, followup }
  }

  it('returns no-agent when the agent mapping is missing', () => {
    const session = makeSession([{ seq: 0, type: 'user/message', data: { message: { content: [] } } }])
    const outcome = maybeContinueTurn(undefined, session, { enabled: true, maxContinuations: 3, prompt: 'go' }, new Map())
    expect(outcome).toEqual({ continued: false, reason: 'no-agent' })
  })

  it('refuses continuations after unclosed tool calls', () => {
    const session = makeSession([assistantEvent(0, ['call-1'])])
    const agent = makeAgent(session, () => {})
    const outcome = maybeContinueTurn(agent, session, { enabled: true, maxContinuations: 3, prompt: 'go' }, new Map())
    expect(outcome).toEqual({ continued: false, reason: 'unclosed-tool-calls' })
  })

  it('continues and counts attempts per session', () => {
    const session = makeSession([{ seq: 0, type: 'user/message', data: { message: { content: [] } } }])
    const received: unknown[] = []
    const agent = makeAgent(session, (message) => received.push(message))
    const counts = new Map<string, number>()
    const first = maybeContinueTurn(agent, session, { enabled: true, maxContinuations: 2, prompt: 'go' }, counts)
    expect(first.continued).toBe(true)
    expect(first.attempt).toBe(1)
    const second = maybeContinueTurn(agent, session, { enabled: true, maxContinuations: 2, prompt: 'go' }, counts)
    expect(second.continued).toBe(true)
    expect(second.attempt).toBe(2)
    const third = maybeContinueTurn(agent, session, { enabled: true, maxContinuations: 2, prompt: 'go' }, counts)
    expect(third).toEqual({ continued: false, reason: 'limit-reached' })
    expect(received).toHaveLength(2)
  })

  it('respects maxContinuations = 0', () => {
    const session = makeSession([{ seq: 0, type: 'user/message', data: { message: { content: [] } } }])
    const agent = makeAgent(session, () => {})
    const outcome = maybeContinueTurn(agent, session, { enabled: true, maxContinuations: 0, prompt: 'go' }, new Map())
    expect(outcome).toEqual({ continued: false, reason: 'limit-reached' })
  })
})
