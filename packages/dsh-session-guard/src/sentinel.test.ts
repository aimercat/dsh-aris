import { describe, expect, it } from 'vitest'
import { maybeCompactEarly, selectEarlyRange, type CompactionServiceLike, type LlmLike, type SentinelSessionLike, type TokenMeterLike } from './sentinel.ts'
import type { PricedNode } from './types.ts'

interface EventInput {
  seq: number
  type: string
  data?: Record<string, unknown>
}

function makeSession(events: EventInput[]): SentinelSessionLike {
  const max = Math.max(0, ...events.map((event) => event.seq))
  const slots = new Array(max + 1)
  for (const event of events) {
    slots[event.seq] = {
      ...event,
      // toolPairingBalancedBefore reads data.message off real events; keep a
      // structurally valid default so the balance walk does not crash.
      data: event.data ?? { message: { content: [] } },
    }
  }
  return {
    id: 's-test',
    events: slots,
    surface: { nodes: events.map((event) => event.seq) },
    requestHeader: () => ({ config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' } }),
  } as SentinelSessionLike
}

function measurement(nodes: PricedNode[], totalTokens: number) {
  return { nodes, totalTokens }
}

describe('selectEarlyRange', () => {
  it('returns null for an empty measurement', () => {
    const session = makeSession([])
    expect(selectEarlyRange(session, measurement([], 0), 10)).toBeNull()
  })

  it('returns null when the surface does not match the meter nodes', () => {
    const session = makeSession([{ seq: 0, type: 'user/message' }, { seq: 1, type: 'user/message' }])
    expect(selectEarlyRange(session, measurement([{ seq: 0, tokens: 10 }], 10), 5)).toBeNull()
  })

  it('returns null when the whole surface must be retained', () => {
    const session = makeSession([{ seq: 0, type: 'user/message' }, { seq: 1, type: 'user/message' }])
    // retainTokens larger than everything: keepFromIdx lands at 0 → null
    expect(selectEarlyRange(session, measurement([{ seq: 0, tokens: 10 }, { seq: 1, tokens: 10 }], 20), 1000)).toBeNull()
  })

  it('selects the head range before the retained tail', () => {
    const session = makeSession([
      { seq: 0, type: 'user/message' },
      { seq: 1, type: 'assistant/message' },
      { seq: 2, type: 'user/message' },
      { seq: 3, type: 'assistant/message' },
    ])
    const nodes: PricedNode[] = [
      { seq: 0, tokens: 10 },
      { seq: 1, tokens: 10 },
      { seq: 2, tokens: 10 },
      { seq: 3, tokens: 10 },
    ]
    // retain 25: tail = seq3(10) + seq2(20) + seq1(30 >= 25) → keepFromIdx = 1
    const range = selectEarlyRange(session, measurement(nodes, 40), 25)
    expect(range).not.toBeNull()
    expect(range?.start).toBe(0)
    expect(range?.end).toBe(0)
    expect(range?.shadowedSeqs).toEqual([0])
  })

  it('keeps tool-call/result pairs balanced at the boundary', () => {
    const session = makeSession([
      { seq: 0, type: 'user/message' },
      { seq: 1, type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', id: 'c1' }] } } },
      { seq: 2, type: 'tool/result', data: { message: { source: { callId: 'c1' } } } },
    ])
    const nodes: PricedNode[] = [
      { seq: 0, tokens: 10 },
      { seq: 1, tokens: 10 },
      { seq: 2, tokens: 10 },
    ]
    const range = selectEarlyRange(session, measurement(nodes, 30), 20)
    // Tail budget 20 is met at seq1 (10) + seq2 (10) → keepFromIdx = 1; the
    // boundary before seq1 is balanced (seq0 is a plain user message, the
    // tool-call/result pair lives inside the retained tail) → shadowed = [0].
    expect(range).not.toBeNull()
    expect(range?.shadowedSeqs).toEqual([0])
  })
})

describe('maybeCompactEarly', () => {
  const signal = new AbortController().signal

  const SESSION = makeSession([
    { seq: 0, type: 'user/message' },
    { seq: 1, type: 'assistant/message' },
    { seq: 2, type: 'user/message' },
    { seq: 3, type: 'assistant/message' },
  ])
  const NODES: PricedNode[] = [
    { seq: 0, tokens: 200_000 },
    { seq: 1, tokens: 200_000 },
    { seq: 2, tokens: 200_000 },
    { seq: 3, tokens: 150_000 },
  ]

  function harness(overrides: {
    compactRegion?: CompactionServiceLike['compactRegion']
    contextWindow?: number
    totalTokens?: number
  } = {}) {
    const calls: Array<{ start: number; end: number }> = []
    // Simulate the effect of a compaction round: the first successful call
    // drops measured pressure below the early threshold.
    let simulated = overrides.totalTokens ?? 750_000
    const compaction: CompactionServiceLike = {
      compactRegion: overrides.compactRegion ?? (async (start, end) => {
        calls.push({ start, end })
        simulated = 500_000
        return { shadowedSeqs: [start], shadowedTokenCount: 42 }
      }),
    }
    const meter: TokenMeterLike = {
      measure: () => measurement(NODES, simulated),
    }
    const llm: LlmLike = {
      // Distinguish "not provided" (default 1M) from an explicit undefined
      // (no declared window — the sentinel must skip).
      resolveModelInfo: async () => ('contextWindow' in overrides
        ? { context: overrides.contextWindow === undefined ? undefined : { contextWindow: overrides.contextWindow } }
        : { context: { contextWindow: 1_000_000 } }),
    }
    return { compaction, meter, llm, calls }
  }

  const baseConfig = { enabled: true, earlyThresholdRatio: 0.7, retainRatio: 0.16, maxRounds: 2 }

  it('skips when there is no routed model', async () => {
    const { compaction, meter, llm } = harness()
    const session = { ...SESSION, requestHeader: () => undefined } as SentinelSessionLike
    expect(await maybeCompactEarly(compaction, meter, llm, session, {}, signal, baseConfig)).toBeNull()
  })

  it('skips when the model declares no context window', async () => {
    const { compaction, meter, llm } = harness({ contextWindow: undefined })
    expect(await maybeCompactEarly(compaction, meter, llm, SESSION, {}, signal, baseConfig)).toBeNull()
  })

  it('skips below the early threshold', async () => {
    const { compaction, meter, llm, calls } = harness({ totalTokens: 500_000 })
    expect(await maybeCompactEarly(compaction, meter, llm, SESSION, {}, signal, baseConfig)).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('stays out of the host band (>= 0.8)', async () => {
    const { compaction, meter, llm, calls } = harness({ totalTokens: 850_000 })
    expect(await maybeCompactEarly(compaction, meter, llm, SESSION, {}, signal, baseConfig)).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('compacts inside the early band via the host compaction service', async () => {
    const { compaction, meter, llm, calls } = harness({ totalTokens: 750_000 })
    const result = await maybeCompactEarly(compaction, meter, llm, SESSION, {}, signal, baseConfig)
    expect(result).not.toBeNull()
    expect(result?.shadowedTokenCount).toBe(42)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ start: 0, end: 1 })
  })

  it('degrades to null when the host compaction lacks compactRegion', async () => {
    const { compaction, meter, llm } = harness({ compactRegion: undefined })
    const result = await maybeCompactEarly({ ...compaction, compactRegion: undefined }, meter, llm, SESSION, {}, signal, baseConfig)
    expect(result).toBeNull()
  })

  it('respects the disabled flag', async () => {
    const { compaction, meter, llm, calls } = harness({ totalTokens: 750_000 })
    expect(await maybeCompactEarly(compaction, meter, llm, SESSION, {}, signal, { ...baseConfig, enabled: false })).toBeNull()
    expect(calls).toHaveLength(0)
  })
})
