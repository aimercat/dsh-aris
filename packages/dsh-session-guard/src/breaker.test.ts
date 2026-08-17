import { describe, expect, it } from 'vitest'
import { GuardBreaker } from './breaker.ts'

describe('GuardBreaker', () => {
  it('counts failures and trips at the threshold', () => {
    const breaker = new GuardBreaker({ enabled: true, maxFailures: 3 })
    expect(breaker.isTripped('a')).toBe(false)
    expect(breaker.recordFailure('a')).toBe(false)
    expect(breaker.failuresFor('a')).toBe(1)
    expect(breaker.recordFailure('a')).toBe(false)
    expect(breaker.recordFailure('a')).toBe(true)
    expect(breaker.isTripped('a')).toBe(true)
  })

  it('tracks sessions independently', () => {
    const breaker = new GuardBreaker({ enabled: true, maxFailures: 2 })
    breaker.recordFailure('a')
    breaker.recordFailure('a')
    breaker.recordFailure('b')
    expect(breaker.isTripped('a')).toBe(true)
    expect(breaker.isTripped('b')).toBe(false)
  })

  it('resets on success', () => {
    const breaker = new GuardBreaker({ enabled: true, maxFailures: 2 })
    breaker.recordFailure('a')
    breaker.recordSuccess('a')
    expect(breaker.failuresFor('a')).toBe(0)
    breaker.recordFailure('a')
    expect(breaker.isTripped('a')).toBe(false)
  })

  it('clears the trip latch on success and reset', () => {
    const breaker = new GuardBreaker({ enabled: true, maxFailures: 1 })
    breaker.recordFailure('a')
    expect(breaker.isTripped('a')).toBe(true)
    breaker.recordSuccess('a')
    expect(breaker.isTripped('a')).toBe(false)
    breaker.recordFailure('a')
    expect(breaker.isTripped('a')).toBe(true)
    breaker.reset('a')
    expect(breaker.isTripped('a')).toBe(false)
    expect(breaker.failuresFor('a')).toBe(0)
  })

  it('does nothing when disabled', () => {
    const breaker = new GuardBreaker({ enabled: false, maxFailures: 1 })
    expect(breaker.recordFailure('a')).toBe(false)
    expect(breaker.isTripped('a')).toBe(false)
    expect(breaker.failuresFor('a')).toBe(0)
  })
})
