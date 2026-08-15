/**
 * Aris thinking-display DOM enhancer — browser half core.
 *
 * Watches the conversation for reasoning blocks (`[data-variant="think"]`,
 * rendered by the official ReasoningRow) and applies the Aris display layer:
 *
 * 1. Folded sections — a completed block's body is split into collapsible
 *    <details> sections (first open, rest closed), so a long thinking trace
 *    reads as numbered steps. Only completed blocks (`data-state="ok"`) are
 *    sectionized: streaming bodies are rewritten by React every chunk, so any
 *    DOM restructure would be clobbered; a per-body observer re-applies the
 *    fold when React resets the text.
 * 2. The title and the typewriter caret are pure CSS (see styles.ts) — the
 *    title swap must survive React reconciliation, so it uses the
 *    visibility + ::after trick instead of a textContent patch.
 *
 * Failure policy: every DOM operation is contained in try/catch and logged —
 * an enhancer problem must degrade the thinking block back to its stock
 * rendering, never break the GUI.
 * @module aris-think/enhancer
 */

import { SECTION_ATTR, SECTION_CLASS } from './styles.ts'

/** Max chars of a paragraph preview shown in a section summary. */
const SUMMARY_LIMIT = 40

/**
 * Rendered fold HTML keyed by the exact body text. Re-opening a thought block
 * makes React re-render the same text, so re-folding hits the cache and sets
 * innerHTML in one pass instead of rebuilding dozens of nodes from scratch —
 * the difference between a 5-second stall and an instant render.
 */
const sectionCache = new Map<string, string>()

/** Escape text before it enters innerHTML (chunks are untrusted model output). */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Fold one reasoning block body into sections. */
function sectionizeBody(body: HTMLElement): void {
  // Detect the fold structurally: a React reset replaces the <details> tree
  // with a plain text node but KEEPS the body element and any marker
  // attribute, so a marker check would wrongly skip re-folding.
  if (body.querySelector(`.${SECTION_CLASS}`) !== null) return
  const raw = body.textContent ?? ''
  const trimmed = raw.trim()
  if (trimmed === '') return
  // Paragraphs on blank lines; fall back to single newlines when the trace is
  // one dense paragraph block. A single chunk is left untouched.
  const paragraphs = trimmed.split(/\n{2,}/).map(part => part.trim()).filter(part => part !== '')
  const chunks = paragraphs.length > 1 ? paragraphs : trimmed.split('\n').map(line => line.trim()).filter(line => line !== '')
  if (chunks.length < 2) return

  let html = sectionCache.get(trimmed)
  if (html === undefined) {
    // All sections render collapsed — a directory of STEP previews.
    html = chunks.map((chunk, index) =>
      `<details class="${SECTION_CLASS}">`
      + `<summary><span>STEP ${index + 1}</span>`
      + `<span class="${SECTION_CLASS}-label">${escapeHtml(summarize(chunk))}</span></summary>`
      + `<div class="${SECTION_CLASS}-body">${escapeHtml(chunk)}</div>`
      + `</details>`,
    ).join('')
    sectionCache.set(trimmed, html)
  }
  body.innerHTML = html
  body.setAttribute(SECTION_ATTR, '')
}

/** First-line preview for a section summary. */
function summarize(chunk: string): string {
  const firstLine = chunk.split('\n')[0] ?? ''
  return firstLine.length > SUMMARY_LIMIT ? `${firstLine.slice(0, SUMMARY_LIMIT)}…` : firstLine
}

/** Re-fold a body whose text React reset since the last sectionize pass. */
function reapplyFold(body: HTMLElement): void {
  // Only sectionize completed blocks: during streaming React rewrites the
  // body every chunk, and re-folding mid-stream would rebuild the whole
  // details tree every debounce tick — a serious main-thread stall.
  try {
    const block = body.closest('[data-variant="think"]')
    if (block === null || block.getAttribute('data-state') !== 'ok') return
    sectionizeBody(body)
  } catch (error) {
    console.warn('[dsh-aris] sectionize failed:', error)
  }
}

/**
 * Enhancer controller: installs one document-level MutationObserver that
 * sectionizes newly mounted completed reasoning blocks, plus a per-body
 * observer that re-applies the fold when React resets a sectionized body.
 * @returns { start, stop } — start installs observers, stop removes the
 *   folds and tears everything down (clean revert to stock rendering).
 */
export function createArisThinkEnhancer(): { start: () => void; stop: () => void } {
  let docObserver: MutationObserver | undefined
  let bodyObservers: MutationObserver[] | undefined
  let observedBodies: Set<HTMLElement> | undefined
  let scheduled = new Set<HTMLElement>()

  const scan = (root: ParentNode): void => {
    if (root.querySelectorAll === undefined) return
    const blocks = root.querySelectorAll<HTMLElement>('[data-variant="think"]')
    blocks.forEach(block => observeBlock(block))
  }

  const observeBlock = (block: HTMLElement): void => {
    const body = block.querySelector<HTMLElement>('[class*="thinkBody"]')
    if (body === null) return
    if (block.getAttribute('data-state') === 'ok') {
      try {
        sectionizeBody(body)
      } catch (error) {
        console.warn('[dsh-aris] sectionize failed:', error)
      }
    }
    if (bodyObservers === undefined || observedBodies === undefined) return
    if (observedBodies.has(body)) return
    observedBodies.add(body)
    // Per-body flag: our own re-fold rewrites the child tree, whose mutations
    // must not schedule another pass. Only React resets should re-trigger.
    let selfMutating = false
    const observer = new MutationObserver(() => {
      if (selfMutating) return
      if (scheduled.has(body)) return
      scheduled.add(body)
      setTimeout(() => {
        scheduled.delete(body)
        selfMutating = true
        try {
          reapplyFold(body)
        } finally {
          selfMutating = false
        }
      }, 120)
    })
    observer.observe(body, { childList: true, characterData: true, subtree: true })
    bodyObservers.push(observer)
  }

  const start = (): void => {
    if (docObserver !== undefined) return
    bodyObservers = []
    observedBodies = new Set()
    docObserver = new MutationObserver(records => {
      for (const record of records) {
        // A block flipping running→ok is an attribute change with no added
        // nodes; re-check the block so the completed fold gets sectionized.
        if (record.type === 'attributes') {
          const target = record.target
          if (target instanceof Element && target.matches('[data-variant="think"]')) {
            observeBlock(target)
          }
          continue
        }
        // Inspect only newly inserted nodes, never re-scan a mutation target:
        // expanding a thought block renders its body as hundreds of text
        // mutations, and a full scan per mutation is a multi-second stall.
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches('[data-variant="think"]')) {
            observeBlock(node)
            continue
          }
          // Collapsing removes the body (observer + fold included); reopening
          // re-creates a brand-new body inside the SAME block, so the block
          // itself is never an added node. Climb from the new child to the
          // owning block and re-observe + re-sectionize it.
          const owner = node.closest('[data-variant="think"]')
          if (owner !== null) {
            observeBlock(owner)
          } else {
            node.querySelectorAll('[data-variant="think"]').forEach(observeBlock)
          }
        }
      }
    })
    docObserver.observe(document.body, {
      childList: true,
      subtree: true,
      // A block flipping running→ok may be the only change at stream end;
      // watching data-state guarantees the completed fold is sectionized even
      // when the final chunk wrote no text mutation.
      attributes: true,
      attributeFilter: ['data-state'],
    })
    // Existing reasoning blocks (e.g. restored history) get enhanced too.
    scan(document.body)
  }

  const stop = (): void => {
    docObserver?.disconnect()
    docObserver = undefined
    if (bodyObservers !== undefined) {
      for (const observer of bodyObservers) observer.disconnect()
      bodyObservers = undefined
      observedBodies = undefined
    }
    scheduled.clear()
    document.querySelectorAll<HTMLElement>('[data-variant="think"]').forEach(block => {
      const body = block.querySelector<HTMLElement>(`[class*="thinkBody"][${SECTION_ATTR}]`)
      if (body === null) return
      // Rebuild the plain text from the folded sections (best effort), then
      // drop the marker so a later re-enable folds it fresh.
      const text = Array.from(body.querySelectorAll(`.${SECTION_CLASS}-body`))
        .map(node => node.textContent ?? '')
        .join('\n\n')
      body.removeAttribute(SECTION_ATTR)
      if (text !== '') body.textContent = text
    })
  }

  return { start, stop }
}
