import { describe, expect, it, vi } from 'vitest'
import { apply } from './index.ts'

interface Handler {
  event: string
  fn: (...args: any[]) => unknown
}

function makeCtx(services: Record<string, unknown> = {}) {
  const handlers: Handler[] = []
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const ctx = {
    on: vi.fn((event: string, fn: (...args: any[]) => unknown) => {
      handlers.push({ event, fn })
      return () => {}
    }),
    get: vi.fn((name: string) => services[name]),
    logger,
  }
  return { ctx, handlers, logger }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    events: [],
    surface: { nodes: [] },
    requestHeader: () => ({ config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } }),
    ...overrides,
  }
}

function runPreStep(handler: Handler, agent: unknown, next = vi.fn()) {
  return handler.fn({ agent, signal: new AbortController().signal }, next)
}

function runTurnEnd(handler: Handler, session: unknown, reason: Record<string, unknown>, turn = 1) {
  return handler.fn(session, { type: 'turn/end', data: { turn, reason } })
}

describe('apply', () => {
  it('registers the pre-step and turn-end event hooks', () => {
    const { ctx, handlers } = makeCtx()
    apply(ctx as never, {} as never)
    expect(handlers.map((h) => h.event)).toEqual(['agent/pre-step', 'session/event'])
  })

  it('registers nothing when disabled', () => {
    const { ctx, handlers } = makeCtx()
    apply(ctx as never, { enabled: false } as never)
    expect(handlers).toHaveLength(0)
  })

  it('propagates configuration validation errors', () => {
    const { ctx } = makeCtx()
    expect(() => apply(ctx as never, { sentinel: { nope: 1 } } as never)).toThrow(/sentinel has unknown key "nope"/)
  })

  it('continues a max-tokens turn through the owning agent', async () => {
    const followup = vi.fn()
    const agent = { session: makeSession(), followup }
    const { ctx, handlers } = makeCtx()
    apply(ctx as never, {} as never)
    const preStep = handlers.find((h) => h.event === 'agent/pre-step')!
    const turnEnd = handlers.find((h) => h.event === 'session/event')!
    await runPreStep(preStep, agent)
    await runTurnEnd(turnEnd, agent.session, { kind: 'max-tokens' })
    expect(followup).toHaveBeenCalledTimes(1)
    const message = followup.mock.calls[0][0] as { role?: string; content?: Array<{ type: string; text: string }>; source?: { kind: string; plugin: string } }
    expect(message.role).toBe('user')
    expect(message.source).toEqual({ kind: 'plugin', plugin: 'dsh-session-guard' })
    expect(message.content?.[0]?.text).toContain('output token limit')
  })

  it('does not continue when the breaker tripped for the session', async () => {
    const followup = vi.fn()
    const session = makeSession()
    const agent = { session, followup }
    const { ctx, handlers } = makeCtx()
    apply(ctx as never, { breaker: { maxFailures: 1 } } as never)
    const preStep = handlers.find((h) => h.event === 'agent/pre-step')!
    const turnEnd = handlers.find((h) => h.event === 'session/event')!
    await runPreStep(preStep, agent)
    // First failure: an un-continuable truncation trips the breaker.
    const sessionWithUnclosedCall = makeSession({
      events: [
        { seq: 0, type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', id: 'c1' }] } } },
      ],
      surface: { nodes: [0] },
    })
    await runTurnEnd(turnEnd, sessionWithUnclosedCall, { kind: 'max-tokens' })
    expect(followup).not.toHaveBeenCalled()
    // Now a clean truncation is suppressed by the tripped breaker.
    await runTurnEnd(turnEnd, session, { kind: 'max-tokens' })
    expect(followup).not.toHaveBeenCalled()
  })

  it('runs the early-compaction sentinel at pre-step with pressure', async () => {
    const compactRegion = vi.fn(async (start: number, end: number) => ({ shadowedSeqs: [start], shadowedTokenCount: 42 }))
    // Simulate the pressure drop a real compaction round produces so the
    // second sentinel round has nothing left to do.
    let measured = 750_000
    const { ctx, handlers } = makeCtx({
      compaction: {
        compactRegion: async (start: number, end: number) => {
          measured = 500_000
          return compactRegion(start, end)
        },
      },
      tokenMeter: {
        measure: () => ({ nodes: [{ seq: 0, tokens: 200_000 }, { seq: 1, tokens: 200_000 }, { seq: 2, tokens: 200_000 }], totalTokens: measured }),
      },
      llm: {
        resolveModelInfo: async () => ({ context: { contextWindow: 1_000_000 } }),
      },
    })
    apply(ctx as never, {} as never)
    const preStep = handlers.find((h) => h.event === 'agent/pre-step')!
    const session = makeSession({
      events: [
        { seq: 0, type: 'user/message', data: { message: { content: [] } } },
        { seq: 1, type: 'assistant/message', data: { message: { content: [] } } },
        { seq: 2, type: 'user/message', data: { message: { content: [] } } },
      ],
      surface: { nodes: [0, 1, 2] },
    })
    await runPreStep(preStep, { session })
    expect(compactRegion).toHaveBeenCalledTimes(1)
  })

  it('writes a failure checkpoint when overflow reaches the user', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const tmpDir = mkdtempSync(join(tmpdir(), 'dsh-session-guard-test-'))
    try {
      const { ctx, handlers } = makeCtx()
      apply(ctx as never, { checkpoint: { dir: tmpDir } } as never)
      const turnEnd = handlers.find((h) => h.event === 'session/event')!
      const session = makeSession({ deriveMessages: () => [{ role: 'user', content: [{ type: 'text', text: 'hello world' }] }] })
      await runTurnEnd(turnEnd, session, {
        kind: 'error',
        error: { code: 'CONTEXT_WINDOW_EXCEEDED', message: 'This model maximum context length is 131072 tokens' },
      })
      const files = (await import('node:fs')).readdirSync(join(tmpDir, 'checkpoints'))
      expect(files).toContain('s1-turn-1.md')
      const body = (await import('node:fs')).readFileSync(join(tmpDir, 'checkpoints', 's1-turn-1.md'), 'utf8')
      expect(body).toContain('# 会话存档（上下文溢出）')
      expect(body).toContain('- [user] hello world')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
