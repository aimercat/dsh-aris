/**
 * Prompt navigation — browser half core.
 *
 * A kilo/Qoder-style「提示词导航」panel for the current conversation: every
 * user prompt (ordinary user messages plus mid-turn steering inserts) in the
 * currently loaded window becomes one list entry; clicking an entry scrolls
 * the chat to that row and flashes it, while scrolling the chat keeps the
 * matching entry highlighted.
 *
 * Data comes from the conversation snapshot (`binding.session.getSnapshot()`
 * → `snapshot.chat.order` + `chat.nodes.get(key)`): the render nodes for the
 * official `input-message` Definition carry `kind: 'user' | 'steering' |
 * 'context'`, and their `data` is the durable `UserMessageNode` /
 * `SteeringMessageNode`. Only in-window nodes exist in `chat.order`, so the
 * index never lists (or fakes jumps to) rows outside the loaded window.
 *
 * Failure policy (same as the thinking enhancer): every DOM operation is
 * contained in try/catch and logged — a controller failure must degrade to
 * "no panel", never break the GUI.
 * @module aris-prompt-nav/controller
 */

import type {
  ChatSnapshot,
  ClientContext,
  ConversationSnapshot,
  ISessions,
  SessionBinding,
  SessionId,
  SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import { ARIS_PRESET_IDS, sessionList } from '../preset.ts'
import { ARIS_AVATAR_DATA_URL } from './avatar.ts'
import {
  NAV_ENTRY_ACTIVE_CLASS,
  NAV_ENTRY_ATTR,
  NAV_ENTRY_CLASS,
  NAV_EMPTY_CLASS,
  NAV_FLASH_CLASS,
  NAV_LIST_CLASS,
  NAV_PANEL_ATTR,
  NAV_PLUGIN_CSS,
  NAV_STYLE_TAG_ID,
  NAV_CSS,
} from './styles.ts'
import type { PromptNavFace } from './toggle.tsx'

/** Panel width in px; the scrollport gets a matching padding-left while open. */
export const PANEL_WIDTH = 304
/** Extra right margin between the panel edge and the chat content. */
const PANEL_GAP = 16
/** Vertical gap between the panel and the scrollport edges. */
const PANEL_INSET = 12
/** Max chars of one prompt preview. */
const PREVIEW_LIMIT = 56
/** Hard cap on indexed entries (memory/perf guard for pathological sessions). */
const MAX_ENTRIES = 500
/** Scroll-bottom stickiness threshold in px. */
const BOTTOM_TOLERANCE = 24
/** Flash duration of the target chat row (must cover the whole animation). */
const FLASH_MS = 2000
/** After a jump, scroll-derived highlight updates stand down for this long,
 *  so the just-selected entry cannot be immediately overwritten by the
 *  scroll event the jump itself fires. */
const JUMP_HOLD_MS = 400

/** One indexed prompt: chat node key + display material. */
export interface PromptNavEntry {
  /** Chat node key, equal to the row's `data-chat-anchor-key`. */
  key: string
  kind: 'user' | 'steering'
  /** Unix epoch ms from the durable node. */
  time: number
  preview: string
}

/** Store snapshot consumed by the header toggle component. */
export interface PromptNavState {
  sessionId: SessionId | undefined
  /** Whether the controller currently follows an Aris session. */
  enabled: boolean
  open: boolean
  count: number
}

const STORAGE_KEY = 'dsh-aris-promptnav'

/**
 * Minimal writable snapshot store. The runtime exports `createSnapshotStore`
 * only from its host bundle — the client bundle has the type but not the
 * value — so the controller carries its own tiny implementation (the
 * framework's selector hooks only need getSnapshot/subscribe; `set`/`update`
 * are our write side).
 */
function createStore<T>(init: T): SnapshotStore<T> {
  let state = init
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void): (() => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    update: (mutator: (draft: T) => void): void => {
      const draft = { ...state }
      mutator(draft)
      state = draft
      for (const listener of listeners) listener()
    },
    set: (next: T): void => {
      state = next
      for (const listener of listeners) listener()
    },
  }
}

/** Extract plain text from core ContentBlocks (text blocks only). */
export function extractPromptText(content: readonly unknown[]): string {
  let out = ''
  for (const block of content) {
    const candidate = block as { type?: unknown; text?: unknown } | null | undefined
    if (candidate !== null && candidate !== undefined && candidate.type === 'text' && typeof candidate.text === 'string') {
      out += candidate.text
    }
  }
  return out
}

/** First-line preview, truncated to the character limit. */
export function summarizePrompt(text: string, limit: number = PREVIEW_LIMIT): string {
  const firstLine = (text.split('\n')[0] ?? '').trim()
  if (firstLine === '') return '（空消息）'
  return firstLine.length > limit ? `${firstLine.slice(0, limit)}…` : firstLine
}

/** HH:MM for today's messages; `M/D HH:MM` otherwise. */
export function formatPromptTime(time: number, now: number = Date.now()): string {
  const date = new Date(time)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const sameDay = new Date(now).toDateString() === date.toDateString()
  return sameDay ? hm : `${date.getMonth() + 1}/${date.getDate()} ${hm}`
}

/**
 * Build the prompt index from a chat snapshot. Walks `chat.order` (the
 * loaded window) and picks `user` / `steering` render nodes only.
 */
export function buildPromptIndex(chat: ChatSnapshot): PromptNavEntry[] {
  const entries: PromptNavEntry[] = []
  for (const key of chat.order) {
    const node = chat.nodes.get(key)
    if (node === undefined) continue
    const kind = node.kind
    if (kind !== 'user' && kind !== 'steering') continue
    const data = node.data as { time?: unknown; content?: readonly unknown[] } | null | undefined
    if (data === null || data === undefined || typeof data.time !== 'number') continue
    entries.push({
      key: node.key,
      kind,
      time: data.time,
      preview: summarizePrompt(extractPromptText(data.content ?? [])),
    })
    if (entries.length >= MAX_ENTRIES) break
  }
  return entries
}

/**
 * Prompt navigation controller: session following, snapshot subscription,
 * index building, panel DOM, jump & highlight.
 *
 * Lifecycle: `attach()` subscribes to the session list and follows the
 * current session forever after; `dispose()` tears everything down. The
 * controller is inert while the current session is not an Aris one (same
 * gate as the thinking enhancer) — no panel, no list, no DOM.
 */
export class PromptNavController {
  private readonly ctx: ClientContext
  private readonly store: SnapshotStore<PromptNavState>
  private readonly openBySession = new Map<SessionId, boolean>()

  private state: PromptNavState = { sessionId: undefined, enabled: false, open: false, count: 0 }
  private entries: PromptNavEntry[] = []
  private readonly entryKeys = new Set<string>()
  private sessionId: SessionId | undefined
  private binding: SessionBinding | undefined
  private scrollport: HTMLElement | undefined
  private originalPaddingLeft: string | undefined

  private panel: HTMLDivElement | undefined
  private listEl: HTMLDivElement | undefined
  private styleTag: HTMLStyleElement | undefined
  private resizeObserver: ResizeObserver | undefined

  private disposeList: (() => void) | undefined
  private disposeSnapshot: (() => void) | undefined
  private disposeScroll: (() => void) | undefined
  private disposeResize: (() => void) | undefined

  private rebuildRaf = 0
  private scrollRaf = 0
  private highlightKey: string | undefined
  private lastJumpAt = 0

  constructor(ctx: ClientContext) {
    this.ctx = ctx
    this.store = createStore<PromptNavState>(this.state)
    this.loadPersisted()
  }

  /** Start following the session list. Idempotent. */
  attach(): void {
    if (this.disposeList !== undefined) return
    // The toggle button renders in the sidebar as soon as an Aris session is
    // followed, long before the panel ever mounts — inject the stylesheet up
    // front so the button never flashes unstyled (stock grey button).
    this.ensureStyle()
    this.disposeList = sessionList(this.ctx).subscribe(() => this.syncSession())
    this.syncSession()
  }

  /** Tear the controller down: subscriptions, panel, style tag. */
  dispose(): void {
    this.disposeList?.()
    this.disposeList = undefined
    this.disposeSnapshot?.()
    this.disposeSnapshot = undefined
    this.binding = undefined
    this.sessionId = undefined
    this.entries = []
    this.entryKeys.clear()
    this.unmountPanel()
    if (this.rebuildRaf !== 0) {
      cancelAnimationFrame(this.rebuildRaf)
      this.rebuildRaf = 0
    }
    if (this.scrollRaf !== 0) {
      cancelAnimationFrame(this.scrollRaf)
      this.scrollRaf = 0
    }
    this.styleTag?.remove()
    this.styleTag = undefined
    this.publishState()
  }

  /** Business face for the header toggle slot entry. */
  inject(): PromptNavFace {
    return {
      hooks: { promptNav: this.store },
      toggle: (sessionId) => this.toggle(sessionId),
    }
  }

  /** Flip the panel for the given session (no-op when it is not the followed one). */
  toggle(sessionId: SessionId): void {
    if (this.sessionId !== sessionId) return
    const next = !(this.openBySession.get(sessionId) ?? false)
    this.openBySession.set(sessionId, next)
    this.persist()
    if (next) {
      this.mountPanel()
    } else {
      this.unmountPanel()
    }
    this.publishState()
  }

  // -- session following -------------------------------------------------

  private syncSession(): void {
    let nextId: SessionId | undefined
    let aris = false
    try {
      const snapshot = sessionList(this.ctx).getSnapshot()
      nextId = snapshot.current as SessionId | undefined
      const summary = nextId === undefined ? undefined
        : (snapshot.byId as Record<string, { agentPreset?: string } | undefined>)[nextId]
      aris = summary?.agentPreset !== undefined && ARIS_PRESET_IDS.has(summary.agentPreset)
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav session read failed:', error)
    }
    if (nextId === this.sessionId) {
      this.publishState()
      return
    }
    this.disposeSnapshot?.()
    this.disposeSnapshot = undefined
    this.binding = undefined
    this.sessionId = nextId
    this.entries = []
    this.entryKeys.clear()
    this.unmountPanel()
    if (nextId === undefined || !aris) {
      this.publishState()
      return
    }
    try {
      // dsh-session's host-plane SessionStore merges over ctx.sessions in some
      // dependency layouts; the client face is ISessions (same pattern as the
      // live2d bridge's sessionsPort cast).
      const sessions = this.ctx.sessions as unknown as ISessions
      const binding = sessions.binding(nextId)
      if (binding === undefined) {
        this.publishState()
        return
      }
      this.binding = binding
      this.disposeSnapshot = binding.session.subscribe(() => this.scheduleRebuild())
      // Restore the persisted panel state for this session: the panel is the
      // source of truth for `open` (the toggle hides while it is mounted), so
      // a restored open flag must actually mount it — otherwise both the panel
      // and the button would be invisible.
      if (this.openBySession.get(nextId) === true) {
        this.mountPanel()
      } else {
        this.unmountPanel()
      }
      this.rebuild()
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav session bind failed:', error)
      this.binding = undefined
    }
    this.publishState()
  }

  private scheduleRebuild(): void {
    if (this.rebuildRaf !== 0) return
    this.rebuildRaf = requestAnimationFrame(() => {
      this.rebuildRaf = 0
      this.rebuild()
    })
  }

  private rebuild(): void {
    const binding = this.binding
    if (binding === undefined) return
    let snapshot: ConversationSnapshot
    try {
      snapshot = binding.session.getSnapshot()
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav snapshot read failed:', error)
      return
    }
    this.entries = buildPromptIndex(snapshot.chat)
    this.entryKeys.clear()
    for (const entry of this.entries) this.entryKeys.add(entry.key)
    if (this.panel !== undefined) {
      this.renderList()
      this.syncPanelPosition()
    }
    this.publishState()
  }

  // -- panel lifecycle ----------------------------------------------------

  private mountPanel(): void {
    if (this.panel !== undefined) return
    try {
      this.ensureStyle()
      const panel = document.createElement('div')
      panel.setAttribute(NAV_PANEL_ATTR, '')

      const head = document.createElement('div')
      head.className = 'aris-prompt-nav-head'
      // Avatar rendered as a background image so the character scale inside
      // the round badge is controlled purely by CSS (background-size).
      const avatar = document.createElement('div')
      avatar.className = 'aris-prompt-nav-avatar'
      avatar.style.backgroundImage = `url(${ARIS_AVATAR_DATA_URL})`
      const title = document.createElement('span')
      title.className = 'aris-prompt-nav-title'
      title.textContent = '提示词导航'
      const close = document.createElement('button')
      close.type = 'button'
      close.className = 'aris-prompt-nav-close'
      close.setAttribute('aria-label', '收起提示词导航')
      close.textContent = '×'
      close.addEventListener('click', () => {
        if (this.sessionId !== undefined) this.toggle(this.sessionId)
      })
      head.append(avatar, title, close)

      const list = document.createElement('div')
      list.className = NAV_LIST_CLASS

      panel.append(head, list)
      this.panel = panel
      this.listEl = list
      document.body.appendChild(panel)

      this.attachScrollport()
      this.renderList()
      this.syncPanelPosition()

      // Re-anchor on window resizes; the ResizeObserver additionally covers
      // scrollport dimension changes (column resizes) without window events.
      window.addEventListener('resize', this.onWindowResize)
      this.disposeResize = () => window.removeEventListener('resize', this.onWindowResize)
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav mount failed:', error)
      // Degrade to "no panel" — never break the GUI.
      this.unmountPanel()
    }
  }

  private unmountPanel(): void {
    this.detachScrollport()
    this.panel?.remove()
    this.panel = undefined
    this.listEl = undefined
    this.highlightKey = undefined
  }

  private ensureStyle(): void {
    if (this.styleTag !== undefined) return
    for (const existing of document.querySelectorAll(`style[data-plugin-css="${NAV_PLUGIN_CSS}"]`)) {
      existing.remove()
    }
    const tag = document.createElement('style')
    tag.id = NAV_STYLE_TAG_ID
    tag.dataset.plugin = '@aimercat/dsh-aris'
    tag.dataset.pluginCss = NAV_PLUGIN_CSS
    tag.textContent = NAV_CSS
    document.head.appendChild(tag)
    this.styleTag = tag
  }

  private attachScrollport(): void {
    this.detachScrollport()
    const scrollport = document.querySelector<HTMLElement>('[data-conversation-scroll]')
    if (scrollport === null) return
    this.scrollport = scrollport
    this.originalPaddingLeft = scrollport.style.paddingLeft || undefined
    scrollport.style.paddingLeft = `${PANEL_WIDTH + PANEL_GAP}px`
    scrollport.addEventListener('scroll', this.onScroll, { passive: true })
    this.disposeScroll = () => scrollport.removeEventListener('scroll', this.onScroll)
    this.resizeObserver = new ResizeObserver(() => this.syncPanelPosition())
    this.resizeObserver.observe(scrollport)
  }

  private detachScrollport(): void {
    this.disposeScroll?.()
    this.disposeScroll = undefined
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    if (this.scrollport !== undefined) {
      if (this.originalPaddingLeft !== undefined) {
        this.scrollport.style.paddingLeft = this.originalPaddingLeft
      } else {
        this.scrollport.style.removeProperty('padding-left')
      }
      this.scrollport = undefined
    }
    this.originalPaddingLeft = undefined
  }

  /** Anchor the fixed panel to the scrollport's box. */
  private syncPanelPosition(): void {
    const panel = this.panel
    const scrollport = this.scrollport
    if (panel === undefined || scrollport === undefined) return
    try {
      const rect = scrollport.getBoundingClientRect()
      panel.style.left = `${rect.left + PANEL_INSET}px`
      panel.style.top = `${rect.top + PANEL_INSET}px`
      panel.style.height = `${Math.max(160, rect.height - PANEL_INSET * 2)}px`
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav position sync failed:', error)
    }
  }

  // -- list rendering ------------------------------------------------------

  private renderList(): void {
    const list = this.listEl
    if (list === undefined) return
    try {
      const stickBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - BOTTOM_TOLERANCE
      const keepScroll = list.scrollTop
      list.textContent = ''
      if (this.entries.length === 0) {
        const empty = document.createElement('div')
        empty.className = NAV_EMPTY_CLASS
        empty.textContent = '暂无提示词，勇士的冒险尚未开始。'
        list.appendChild(empty)
      } else {
        this.entries.forEach((entry, index) => {
          list.appendChild(this.renderEntry(entry, index))
        })
        // Streaming appends keep the tail visible only while the user was
        // already at the bottom; otherwise the reading position is preserved.
        if (stickBottom) {
          list.scrollTop = list.scrollHeight
        } else {
          list.scrollTop = keepScroll
        }
      }
      this.syncHighlight()
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav render failed:', error)
    }
  }

  private renderEntry(entry: PromptNavEntry, index: number): HTMLButtonElement {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = NAV_ENTRY_CLASS
    row.setAttribute(NAV_ENTRY_ATTR, entry.key)
    row.setAttribute('aria-label', `提示词 ${index + 1}`)

    const no = document.createElement('span')
    no.className = 'aris-prompt-nav-no'
    no.textContent = String(index + 1)

    const preview = document.createElement('span')
    preview.className = 'aris-prompt-nav-preview'
    preview.textContent = entry.preview

    const meta = document.createElement('span')
    meta.className = 'aris-prompt-nav-meta'
    const time = document.createElement('span')
    time.className = 'aris-prompt-nav-time'
    time.textContent = formatPromptTime(entry.time)
    meta.appendChild(time)
    if (entry.kind === 'steering') {
      const badge = document.createElement('span')
      badge.className = 'aris-prompt-nav-badge'
      badge.textContent = '插入'
      meta.appendChild(badge)
    }

    row.append(no, preview, meta)
    row.addEventListener('click', () => this.jumpTo(entry.key))
    return row
  }

  // -- jump & highlight -----------------------------------------------------

  /** Scroll the chat to the row of `key` and flash it. No-op when the row is
   *  not in the rendered window (never fake-jump). */
  private jumpTo(key: string): void {
    const scrollport = this.scrollport
    if (scrollport === undefined) return
    try {
      let row: HTMLElement | null = null
      for (const candidate of scrollport.querySelectorAll<HTMLElement>('[data-chat-anchor-key]')) {
        if (candidate.dataset.chatAnchorKey === key) {
          row = candidate
          break
        }
      }
      if (row === null) return
      const top = row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top
      scrollport.scrollTop = Math.max(0, top - PANEL_INSET)
      // Selection is explicit here and must survive the scroll events the
      // jump fires: hold off scroll-derived updates for a moment, and
      // re-sync once layout settles so the flash cannot be re-rendered away.
      this.lastJumpAt = Date.now()
      this.highlightKey = key
      this.syncHighlight()
      row.classList.add(NAV_FLASH_CLASS)
      window.setTimeout(() => {
        row.classList.remove(NAV_FLASH_CLASS)
      }, FLASH_MS)
      window.setTimeout(() => {
        // Late re-sync: covers a scroll event that slipped past the hold
        // window and any React re-render that reset the row's classes.
        this.highlightKey = key
        this.syncHighlight()
      }, 140)
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav jump failed:', error)
    }
  }

  private onScroll = (): void => {
    if (this.scrollRaf !== 0) return
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0
      this.updateHighlight()
    })
  }

  private onWindowResize = (): void => {
    this.syncPanelPosition()
  }

  /** Track the first visible indexed prompt row (official paging-anchor logic). */
  private updateHighlight(): void {
    const scrollport = this.scrollport
    if (scrollport === undefined) return
    // The jump just selected a row explicitly; its own scroll event must not
    // overwrite the selection (the row can sit slightly outside the strict
    // viewport test while the jump is settling).
    if (Date.now() - this.lastJumpAt < JUMP_HOLD_MS) return
    let found: string | undefined
    try {
      const viewport = scrollport.getBoundingClientRect()
      for (const row of scrollport.querySelectorAll<HTMLElement>('[data-chat-anchor-key]')) {
        const rect = row.getBoundingClientRect()
        if (rect.bottom > viewport.top && rect.top < viewport.bottom) {
          const key = row.dataset.chatAnchorKey
          if (key !== undefined && this.entryKeys.has(key)) {
            found = key
            break
          }
        }
      }
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav highlight scan failed:', error)
      return
    }
    if (found === this.highlightKey) return
    this.highlightKey = found
    this.syncHighlight()
  }

  /** Reflect the highlighted entry in the panel list. */
  private syncHighlight(): void {
    const list = this.listEl
    if (list === undefined) return
    let activeRow: HTMLElement | null = null
    for (const row of list.children) {
      if (!(row instanceof HTMLElement)) continue
      const active = row.getAttribute(NAV_ENTRY_ATTR) === this.highlightKey
      row.classList.toggle(NAV_ENTRY_ACTIVE_CLASS, active)
      if (active) activeRow = row
    }
    if (activeRow !== null) {
      try {
        activeRow.scrollIntoView({ block: 'nearest' })
      } catch {
        // scrollIntoView options unsupported in odd environments — noop.
      }
    }
  }

  // -- state / persistence ---------------------------------------------------

  private publishState(): void {
    const next: PromptNavState = {
      sessionId: this.sessionId,
      enabled: this.sessionId !== undefined && this.binding !== undefined,
      // The mounted panel is the single source of truth for `open`: a
      // persisted open flag without a mounted panel must not hide the toggle.
      open: this.panel !== undefined,
      count: this.entries.length,
    }
    this.state = next
    this.store.set(next)
  }

  private loadPersisted(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === null) return
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (typeof parsed !== 'object' || parsed === null) return
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'boolean') this.openBySession.set(key as SessionId, value)
      }
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav storage read failed:', error)
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(this.openBySession)))
    } catch (error) {
      console.warn('[dsh-aris] prompt-nav storage write failed:', error)
    }
  }
}
