import type { ObservableSnapshot, SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

export type FieldWrite =
  | { kind: 'set'; value: unknown }
  | { kind: 'clear' }

export interface FieldSpec {
  field: string
  format: (value: unknown) => string
  parse: (text: string) => FieldWrite | undefined
}

export interface CardFieldState {
  text: string
  overridden: boolean
  invalid: boolean
}

export interface CardShell {
  available: boolean
  exposed: boolean
  writable: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
  failed: boolean
}

export interface CardActions {
  edit: (field: string, text: string) => void
  resetField: (field: string) => void
  save: () => void
  discard: () => void
}

interface StagedEdit {
  text: string
  clear: boolean
}

interface PlannedWrite {
  field: string
  run: (() => Promise<boolean>) | undefined
}

function createLocalSnapshotStore<T>(init: T): SnapshotStore<T> {
  let snapshot = init
  const listeners = new Set<() => void>()
  return {
    getSnapshot(): T {
      return snapshot
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next: T): void {
      snapshot = next
      for (const listener of listeners) listener()
    },
  } as SnapshotStore<T>
}

export function booleanField(field: string): FieldSpec {
  return {
    field,
    format: value => typeof value === 'boolean' ? String(value) : '',
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      if (trimmed === 'true') return { kind: 'set', value: true }
      if (trimmed === 'false') return { kind: 'set', value: false }
      return undefined
    },
  }
}

export function stringField(field: string): FieldSpec {
  return {
    field,
    format: value => typeof value === 'string' ? value : '',
    parse: text => ({ kind: 'set', value: text }),
  }
}

export class CardForm<T> {
  private readonly specs: Map<string, FieldSpec>
  private readonly staged = new Map<string, StagedEdit>()
  private readonly listeners = new Set<() => void>()
  private saving = false
  private failed = false

  constructor(
    private readonly scope: SettingsScope<T>,
    specs: FieldSpec[],
  ) {
    this.specs = new Map(specs.map(spec => [spec.field, spec]))
    scope.subscribe(() => { this.publish() })
  }

  bind<S>(project: () => S): SnapshotStore<S> {
    const store = createLocalSnapshotStore(project())
    this.listeners.add(() => { store.set(project()) })
    return store
  }

  shell(): CardShell {
    const snapshot = this.scope.getSnapshot()
    const plan = this.plan()
    return {
      available: snapshot.status !== 'loading',
      exposed: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some(item => item.run === undefined),
      saving: this.saving,
      failed: this.failed,
    }
  }

  field(field: string): CardFieldState {
    const spec = this.specOf(field)
    const staged = this.staged.get(field)
    if (staged === undefined) {
      return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false }
    }
    const write = staged.clear ? { kind: 'clear' as const } : spec.parse(staged.text)
    return {
      text: staged.text,
      overridden: write?.kind === 'set',
      invalid: write === undefined,
    }
  }

  actions(): CardActions {
    return {
      edit: (field, text) => { this.stage(field, { text, clear: false }) },
      resetField: (field) => {
        this.stage(field, { text: this.specOf(field).format(this.baseValue(field)), clear: true })
      },
      save: () => { void this.save() },
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return
        this.staged.clear()
        this.failed = false
        this.publish()
      },
    }
  }

  async save(): Promise<void> {
    const plan = this.plan()
    const writes = plan.flatMap(item => item.run === undefined ? [] : [item.run])
    if (plan.length === 0 || this.saving || writes.length !== plan.length) return
    const fields = new Set(plan.map(item => item.field))
    this.saving = true
    this.failed = false
    this.publish()
    let landed = true
    for (const write of writes) {
      landed = await write() && landed
    }
    if (landed) {
      for (const field of fields) this.staged.delete(field)
    }
    this.saving = false
    this.failed = !landed
    this.publish()
  }

  private plan(): PlannedWrite[] {
    const plan: PlannedWrite[] = []
    for (const [field, staged] of this.staged) {
      const spec = this.specOf(field)
      const write = staged.clear ? { kind: 'clear' as const } : spec.parse(staged.text)
      if (write === undefined) {
        plan.push({ field, run: undefined })
        continue
      }
      if (write.kind === 'clear') {
        const alreadyInherited = !(field in this.userLayer())
        plan.push({ field, run: alreadyInherited ? async () => true : async () => { await this.scope.unset(field); return !(field in this.userLayer()) } })
        continue
      }
      const stored = this.sectionValue(field)
      const sameValue = JSON.stringify(stored) === JSON.stringify(write.value)
      const alreadyStored = sameValue && this.stored(field)
      plan.push({ field, run: alreadyStored ? async () => true : async () => { await this.scope.set(field, write.value); return JSON.stringify(this.sectionValue(field)) === JSON.stringify(write.value) && this.stored(field) } })
    }
    return plan
  }

  private stage(field: string, edit: StagedEdit): void {
    if (!this.specs.has(field)) throw new Error(`settings card has no field ${field}`)
    this.staged.set(field, edit)
    this.failed = false
    this.publish()
  }

  private specOf(field: string): FieldSpec {
    const spec = this.specs.get(field)
    if (spec === undefined) throw new Error(`settings card has no field ${field}`)
    return spec
  }

  private sectionValue(field: string): unknown {
    const snapshot = this.scope.getSnapshot()
    const value = snapshot.value
    return value !== undefined && value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[field] : undefined
  }

  private baseValue(field: string): unknown {
    const base = this.scope.getSnapshot().base
    return base !== undefined && base !== null && typeof base === 'object' ? (base as Record<string, unknown>)[field] : undefined
  }

  private userLayer(): Record<string, unknown> {
    const user = this.scope.getSnapshot().user
    return user !== undefined && user !== null && typeof user === 'object' ? user as Record<string, unknown> : {}
  }

  private stored(field: string): boolean {
    return field in this.userLayer()
  }

  private publish(): void {
    for (const listener of this.listeners) listener()
  }
}
