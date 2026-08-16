import { Application, Ticker } from 'pixi.js'
import type { ArisAvatarIntent, ArisAvatarPriority, ArisAvatarTone } from '../../live2d/types.ts'
import type { Live2DOverlay } from './overlay.ts'
import { STAGE_HEIGHT, STAGE_WIDTH } from './state.ts'

export interface Live2DRuntimeConfig {
  modelBase: string
  cubismCoreUrl: string
  scale: number
  followPointer: boolean
}

interface RuntimeModel {
  anchor: { set(x: number, y?: number): void }
  scale: { set(value: number): void }
  position: { set(x: number, y: number): void }
  getLocalBounds(): { width: number; height: number }
  focus(x: number, y: number, instant?: boolean): void
  expression(id?: number | string): Promise<boolean>
  motion(group: string, index?: number, priority?: number): Promise<boolean>
}

let cubismCorePromise: Promise<void> | undefined

function motionPriority(value: ArisAvatarPriority | undefined): number {
  switch (value) {
    case 'idle': return 1
    case 'force': return 3
    default: return 2
  }
}

async function ensureCubismCore(url: string): Promise<void> {
  if ((window as Window & { Live2DCubismCore?: unknown }).Live2DCubismCore !== undefined) return
  if (cubismCorePromise !== undefined) return cubismCorePromise
  if (url.trim() === '') throw new Error('live2d cubism core URL is empty')
  cubismCorePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-dsh-aris-cubism-core="1"]')
    if (existing !== null) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`failed to load cubism core from ${url}`)), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.dataset.dshArisCubismCore = '1'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error(`failed to load cubism core from ${url}`)), { once: true })
    document.head.appendChild(script)
  })
  return cubismCorePromise
}

async function loadCubism4Module(): Promise<{ Live2DModel: { from(source: string, options?: Record<string, unknown>): Promise<RuntimeModel> } }> {
  return import('./cubism4-module.ts') as Promise<{ Live2DModel: { from(source: string, options?: Record<string, unknown>): Promise<RuntimeModel> } }>
}

function semanticExpression(semantic: 'greeting' | 'thinking' | 'warning' | 'victory' | 'idle'): string | undefined {
  switch (semantic) {
    case 'thinking': return 'f01'
    case 'warning': return 'f03'
    case 'victory': return 'f02'
    case 'greeting': return 'f02'
    default: return undefined
  }
}

function semanticMotion(semantic: 'greeting' | 'thinking' | 'warning' | 'victory' | 'idle'): { group: string; priority?: ArisAvatarPriority } | undefined {
  switch (semantic) {
    case 'greeting': return { group: 'Idle', priority: 'normal' }
    case 'thinking': return { group: 'Idle', priority: 'idle' }
    case 'warning': return { group: 'TapBody', priority: 'force' }
    case 'victory': return { group: 'TapBody', priority: 'normal' }
    case 'idle': return { group: 'Idle', priority: 'idle' }
  }
}

export class Live2DAvatarRuntime {
  private readonly overlay: Live2DOverlay
  private readonly config: Live2DRuntimeConfig
  private app: Application | undefined
  private model: RuntimeModel | undefined
  private bubbleTimer: number | undefined
  private destroyed = false
  private pointerMoveHandler: ((event: PointerEvent) => void) | undefined

  constructor(overlay: Live2DOverlay, config: Live2DRuntimeConfig) {
    this.overlay = overlay
    this.config = config
  }

  async init(): Promise<void> {
    if (this.destroyed || this.model !== undefined) return
    await ensureCubismCore(this.config.cubismCoreUrl)
    const { Live2DModel } = await loadCubism4Module()
    const app = new Application()
    await app.init({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      antialias: true,
      backgroundAlpha: 0,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
      sharedTicker: true,
    })
    if (this.destroyed) {
      this.safeDestroyApp(app)
      return
    }

    this.overlay.stage.setAttribute('data-stage-state', 'core-ready')
    this.overlay.stage.textContent = 'Aris Live2D loading model...'
    this.overlay.stage.replaceChildren(app.canvas)
    this.app = app

    const model = await Live2DModel.from(this.config.modelBase, {
      autoInteract: false,
      autoFocus: this.config.followPointer,
      autoHitTest: false,
      autoUpdate: true,
      ticker: Ticker.shared,
    }) as RuntimeModel

    if (this.destroyed) {
      if (this.app === app) this.app = undefined
      this.safeDestroyApp(app)
      return
    }

    this.model = model
    this.overlay.stage.setAttribute('data-stage-state', 'ready')
    model.anchor.set(0.5, 1)
    app.stage.addChild(model as never)
    this.fitModel(this.config.scale)
    this.attachPointerTracking()
    await this.performSemantic('greeting')
  }

  private safeDestroyApp(app: Application): void {
    try {
      app.destroy()
    } catch (error) {
      console.warn('[dsh-aris] live2d app destroy failed:', error)
      app.canvas.remove()
    }
  }

  private fitModel(scale: number): void {
    if (this.model === undefined) return
    const bounds = this.model.getLocalBounds()
    const width = Math.max(1, bounds.width)
    const height = Math.max(1, bounds.height)
    const baseScale = Math.min((STAGE_WIDTH * 0.78) / width, (STAGE_HEIGHT * 0.9) / height)
    const resolved = Number.isFinite(baseScale) && baseScale > 0 ? baseScale : 0.2
    this.model.scale.set(resolved * scale)
    this.model.position.set(STAGE_WIDTH * 0.5, STAGE_HEIGHT - 10)
  }

  private attachPointerTracking(): void {
    if (!this.config.followPointer || this.model === undefined || this.app === undefined || this.pointerMoveHandler !== undefined) return
    this.pointerMoveHandler = (event: PointerEvent): void => {
      if (this.model === undefined || this.app === undefined) return
      const rect = this.app.canvas.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      this.model.focus(x, y, false)
    }
    this.overlay.stage.addEventListener('pointermove', this.pointerMoveHandler)
  }

  async applyIntent(intent: ArisAvatarIntent): Promise<void> {
    if (intent.type === 'bubble') {
      this.showBubble(intent.text, intent.tone, intent.durationMs)
      return
    }
    if (this.model === undefined) return
    if (intent.type === 'expression') {
      try {
        await this.model.expression(intent.expression)
      } catch {
        // Missing expression is non-fatal.
      }
      return
    }
    try {
      if (intent.index === undefined) await this.model.motion(intent.group, undefined, motionPriority(intent.priority))
      else await this.model.motion(intent.group, intent.index, motionPriority(intent.priority))
    } catch {
      // Missing motion group is non-fatal.
    }
  }

  async performSemantic(semantic: 'greeting' | 'thinking' | 'warning' | 'victory' | 'idle'): Promise<void> {
    const expression = semanticExpression(semantic)
    if (expression !== undefined) await this.applyIntent({ type: 'expression', expression })
    const motion = semanticMotion(semantic)
    if (motion !== undefined) await this.applyIntent({ type: 'motion', group: motion.group, priority: motion.priority })
    if (semantic === 'warning') this.showBubble('老师！这里有隐藏陷阱（Bug）！', 'warning', 2200)
  }

  showBubble(text: string, tone: ArisAvatarTone | undefined, durationMs = 2000): void {
    if (this.bubbleTimer !== undefined) window.clearTimeout(this.bubbleTimer)
    this.overlay.setBubble(text, tone)
    this.bubbleTimer = window.setTimeout(() => {
      this.bubbleTimer = undefined
      this.overlay.setBubble(null, undefined)
    }, durationMs)
  }

  setScale(scale: number): void {
    this.fitModel(scale)
  }

  destroy(): void {
    this.destroyed = true
    if (this.bubbleTimer !== undefined) window.clearTimeout(this.bubbleTimer)
    this.bubbleTimer = undefined
    this.overlay.setBubble(null, undefined)
    if (this.pointerMoveHandler !== undefined) {
      this.overlay.stage.removeEventListener('pointermove', this.pointerMoveHandler)
      this.pointerMoveHandler = undefined
    }
    const app = this.app
    this.app = undefined
    this.model = undefined
    if (app !== undefined) this.safeDestroyApp(app)
  }
}
