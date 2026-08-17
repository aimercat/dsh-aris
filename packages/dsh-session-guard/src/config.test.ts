import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTINUATION_PROMPT, resolveConfig } from './config.ts'

describe('resolveConfig', () => {
  it('applies defaults for an empty config', () => {
    const config = resolveConfig({})
    expect(config.enabled).toBe(true)
    expect(config.continuation.enabled).toBe(true)
    expect(config.continuation.maxContinuations).toBe(3)
    expect(config.continuation.prompt).toBe(DEFAULT_CONTINUATION_PROMPT)
    expect(config.sentinel.enabled).toBe(true)
    expect(config.sentinel.earlyThresholdRatio).toBe(0.7)
    expect(config.sentinel.retainRatio).toBe(0.16)
    expect(config.sentinel.maxRounds).toBe(2)
    expect(config.breaker.enabled).toBe(true)
    expect(config.breaker.maxFailures).toBe(3)
    expect(config.checkpoint.enabled).toBe(true)
    expect(config.checkpoint.dir).toBe('.dsh/session-guard')
  })

  it('deeply freezes the resolved snapshot', () => {
    const config = resolveConfig({})
    expect(Object.isFrozen(config)).toBe(true)
    expect(Object.isFrozen(config.continuation)).toBe(true)
    expect(Object.isFrozen(config.sentinel)).toBe(true)
  })

  it('accepts explicit overrides', () => {
    const config = resolveConfig({
      enabled: false,
      continuation: { maxContinuations: 5 },
      sentinel: { earlyThresholdRatio: 0.65, retainRatio: 0.2, maxRounds: 3 },
      breaker: { maxFailures: 2 },
      checkpoint: { dir: '.guard' },
    })
    expect(config.enabled).toBe(false)
    expect(config.continuation.maxContinuations).toBe(5)
    expect(config.sentinel.earlyThresholdRatio).toBe(0.65)
    expect(config.sentinel.retainRatio).toBe(0.2)
    expect(config.sentinel.maxRounds).toBe(3)
    expect(config.breaker.maxFailures).toBe(2)
    expect(config.checkpoint.dir).toBe('.guard')
  })

  it('rejects unknown top-level keys', () => {
    expect(() => resolveConfig({ nope: true } as never)).toThrow(/unknown key "nope"/)
  })

  it('rejects unknown nested keys', () => {
    expect(() => resolveConfig({ continuation: { nope: 1 } as never })).toThrow(/continuation has unknown key "nope"/)
    expect(() => resolveConfig({ sentinel: { nope: 1 } as never })).toThrow(/sentinel has unknown key "nope"/)
    expect(() => resolveConfig({ breaker: { nope: 1 } as never })).toThrow(/breaker has unknown key "nope"/)
    expect(() => resolveConfig({ checkpoint: { nope: 1 } as never })).toThrow(/checkpoint has unknown key "nope"/)
  })

  it('rejects an invalid retention/threshold ratio pair', () => {
    expect(() => resolveConfig({ sentinel: { earlyThresholdRatio: 0.5, retainRatio: 0.5 } })).toThrow(/retainRatio .* must be less than/)
  })

  it('rejects non-number ratios and non-integer counts', () => {
    expect(() => resolveConfig({ sentinel: { earlyThresholdRatio: 1.5 } })).toThrow(/must be a number in \(0, 1\]/)
    expect(() => resolveConfig({ sentinel: { retainRatio: 0 } })).toThrow(/must be a number in \(0, 1\]/)
    expect(() => resolveConfig({ sentinel: { maxRounds: 0 } })).toThrow(/must be a positive integer/)
    expect(() => resolveConfig({ continuation: { maxContinuations: -1 } })).toThrow(/must be a non-negative integer/)
    expect(() => resolveConfig({ breaker: { maxFailures: 0 } })).toThrow(/must be a positive integer/)
  })

  it('rejects non-boolean switches and non-string prompt/dir', () => {
    expect(() => resolveConfig({ enabled: 'yes' as never })).toThrow(/enabled must be a boolean/)
    expect(() => resolveConfig({ continuation: { enabled: 1 as never } })).toThrow(/continuation.enabled must be a boolean/)
    expect(() => resolveConfig({ continuation: { prompt: 42 as never } })).toThrow(/continuation.prompt must be a string/)
    expect(() => resolveConfig({ checkpoint: { dir: '' } })).toThrow(/must be a non-empty string/)
  })
})
