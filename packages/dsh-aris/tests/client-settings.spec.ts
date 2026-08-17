import { describe, expect, it } from 'vitest'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { registerArisLive2DSettingsCard } from '../src/client/live2d-settings/index.ts'

interface RegisteredRow {
  name: string
  id: string
}

interface InjectEntry {
  key: string
  fire: () => () => void
  dispose: () => void
}

function createMockCtx() {
  const registered: RegisteredRow[] = []
  const injects: InjectEntry[] = []

  const slots = {
    register: (opts: { name: string; id: string }): (() => void) => {
      const row = { name: opts.name, id: opts.id }
      registered.push(row)
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        const index = registered.findIndex(r => r.name === row.name && r.id === row.id)
        if (index >= 0) registered.splice(index, 1)
      }
    },
    inject: (key: string, cb: () => () => void): (() => void) => {
      // Declaration-aware semantics (mirrors SlotRegistry.inject): the
      // callback runs when the slot is declared; the returned disposer
      // cancels the wait AND the active effect.
      let active: (() => void) | undefined
      let disposed = false
      const entry: InjectEntry = {
        key,
        fire: () => {
          if (disposed) return () => {}
          active = cb()
          return () => { active?.() }
        },
        dispose: () => {
          disposed = true
          active?.()
        },
      }
      injects.push(entry)
      return entry.dispose
    },
  }

  const ctx = {
    effect: (fn: () => void) => { fn() },
    locale: { register: () => {} },
    get: () => undefined,
    slots,
  } as unknown as ClientContext

  return { ctx, registered, injects }
}

describe('registerArisLive2DSettingsCard', () => {
  it('registers both the top-level fallback and the group-slot inject', () => {
    const { ctx, injects } = createMockCtx()
    registerArisLive2DSettingsCard(ctx)
    expect(injects.map(e => e.key).sort()).toEqual(['aris.plugin.item', 'settings.plugin.item'])
  })

  it('renders in the top-level slot when no family group host exists (standalone)', () => {
    const { ctx, registered, injects } = createMockCtx()
    registerArisLive2DSettingsCard(ctx)
    // Simulate the official settings section declaring settings.plugin.item.
    injects.find(e => e.key === 'settings.plugin.item')!.fire()
    expect(registered).toEqual([{ name: 'settings.plugin.item', id: 'aris-live2d-settings' }])
  })

  it('migrates the card into the family group when the host declares the child slot', () => {
    const { ctx, registered, injects } = createMockCtx()
    registerArisLive2DSettingsCard(ctx)
    injects.find(e => e.key === 'settings.plugin.item')!.fire()
    expect(registered).toEqual([{ name: 'settings.plugin.item', id: 'aris-live2d-settings' }])

    // dsh-aris-settings declares aris.plugin.item afterwards: the top-level
    // card is disposed and the card re-registers inside the group.
    injects.find(e => e.key === 'aris.plugin.item')!.fire()
    expect(registered).toEqual([{ name: 'aris.plugin.item', id: 'aris-live2d-settings' }])
  })

  it('unregisters the group card when the host collapses the child slot', () => {
    const { ctx, registered, injects } = createMockCtx()
    registerArisLive2DSettingsCard(ctx)
    const top = injects.find(e => e.key === 'settings.plugin.item')!
    top.fire()
    const group = injects.find(e => e.key === 'aris.plugin.item')!
    group.fire()
    expect(registered).toHaveLength(1)

    group.dispose()
    expect(registered).toEqual([])
  })
})
