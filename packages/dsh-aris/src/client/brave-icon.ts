/**
 * Brave permission icon — browser half.
 *
 * Marks the「勇者权限」(brave) row in the permission menu / `/permission`
 * picker with an Aris-branded sparkle glyph (the light of 光之剑), using the
 * same DOM-decoration technique as `@nanmicoder/dsh-auto-mode`'s client
 * (MIT, Copyright (c) 2026 程序员阿江-Relakkes): observe rendered menus,
 * identify the permission menu by its full preset set, and decorate the brave
 * row plus the active permission trigger via a data attribute and a CSS mask.
 *
 * Unlike the Aris thinking enhancer, this decorator is NOT gated on the `aris`
 * agent preset: the permission picker is a global UI surface, and the brave
 * row exists whenever this plugin is installed. The decorator owns no
 * permission state — selecting a row still flows through the official
 * `/permission` command and host preset service.
 * @module @aimercat/dsh-aris/client/brave-icon
 */

const PLUGIN_ID = '@aimercat/dsh-aris'
const PLUGIN_CSS = `${PLUGIN_ID}/brave-icon`
const ICON_ATTRIBUTE = 'data-dsh-aris-brave-icon'

/** The brave preset display name (Host preset table) and its English alias. */
const BRAVE_LABELS = ['勇者权限', 'Brave'] as const

/** Other permission rows that must coexist for a menu to be the permission menu. */
const PERMISSION_ROW_PATTERNS = [
  /^(?:Read Only|只读)$/i,
  /^(?:Workspace Write|工作区写入|工作区写)$/i,
  /^(?:Full access|完全访问|全部访问|完整访问)$/i,
] as const

/**
 * Sparkle glyph was the placeholder; the real deal is 光之剑 (Giant Swords /
 * 超新星) — Aris's signature weapon. The sword silhouette with a soft glow
 * reads as the brave permission: sharp, bright, and unmistakably Aris.
 * Mask uses alpha, so the rendered color comes from the CSS background
 * gradient below (Aris blue), not the SVG fills.
 */
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">'
  + '<rect x="5.6" y="0.2" width="4.8" height="15.4" rx="2.4" fill="black" opacity="0.22"/>'
  + '<path d="M8 0.8 9.3 2.9 8 4.1 6.7 2.9 Z" fill="black"/>'
  + '<path d="M7 3.8 9 3.8 9.1 9.4 8 10.2 6.9 9.4 Z" fill="black"/>'
  + '<rect x="5.3" y="10.2" width="5.4" height="1.3" rx="0.65" fill="black"/>'
  + '<rect x="7.2" y="11.5" width="1.6" height="2.4" rx="0.8" fill="black"/>'
  + '<circle cx="8" cy="14.5" r="1" fill="black"/>'
  + '</svg>'

function iconStyles(): string {
  const mask = `url("data:image/svg+xml,${encodeURIComponent(ICON_SVG)}")`
  return `
[${ICON_ATTRIBUTE}]::before {
  content: "";
  display: inline-block;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin-right: 4px;
  /* Aris blue — the light of 光之剑, dark → light gradient for a glow edge. */
  background: linear-gradient(180deg, #a6d4ff 0%, #4fa3ff 45%, #2f7be8 100%);
  -webkit-mask-image: ${mask};
  mask-image: ${mask};
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}
[${ICON_ATTRIBUTE}="trigger"]::before {
  width: 14px;
  height: 14px;
  margin-right: 0;
}
`
}

function normalizedText(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function isBraveLabel(text: string): boolean {
  return BRAVE_LABELS.some(label => label === text)
}

/** A rendered menu is the permission menu when it carries brave + the official rows. */
function isPermissionMenu(menu: Element): boolean {
  const labels = Array.from(menu.querySelectorAll('button[role="menuitem"]'), normalizedText)
  if (!labels.some(isBraveLabel)) return false
  return labels.filter(label => PERMISSION_ROW_PATTERNS.some(pattern => pattern.test(label))).length >= 2
}

function isBraveMenuItem(element: Element): boolean {
  if (!element.matches('button[role="menuitem"]') || !isBraveLabel(normalizedText(element))) return false
  const menu = element.closest('[role="menu"]')
  return menu !== null && isPermissionMenu(menu)
}

/** The bare `/permission` popup renders options inside a labeled listbox. */
function isBravePermissionOption(element: Element): boolean {
  if (!element.matches('[role="option"]')) return false
  const listbox = element.closest('[role="listbox"][aria-label]')
  const listboxLabel = listbox?.getAttribute('aria-label') ?? ''
  if (!/^\/permission\s+(?:matches|匹配项)$/i.test(listboxLabel.trim())) return false
  return isBraveLabel(normalizedText(element.firstElementChild ?? element))
}

function isBraveTrigger(element: Element): boolean {
  if (!element.matches('button[aria-label]')) return false
  const label = element.getAttribute('aria-label') ?? ''
  return /(?:访问模式|Access mode)/i.test(label) && BRAVE_LABELS.some(alias => label.includes(alias))
}

/** Mark the brave permission row and active trigger for CSS decoration. */
function decorateBravePermissionIcons(document: Document): void {
  for (const marked of document.querySelectorAll(`[${ICON_ATTRIBUTE}]`)) {
    const kind = marked.getAttribute(ICON_ATTRIBUTE)
    if ((kind === 'menu' && !isBraveMenuItem(marked)) || (kind === 'trigger' && !isBraveTrigger(marked))) {
      marked.removeAttribute(ICON_ATTRIBUTE)
    }
  }

  for (const menu of document.querySelectorAll('[role="menu"]')) {
    if (!isPermissionMenu(menu)) continue
    for (const item of menu.querySelectorAll('button[role="menuitem"]')) {
      if (isBraveLabel(normalizedText(item))) item.setAttribute(ICON_ATTRIBUTE, 'menu')
    }
  }

  for (const button of document.querySelectorAll('button[aria-label]')) {
    if (isBraveTrigger(button)) button.setAttribute(ICON_ATTRIBUTE, 'trigger')
  }
}

/** Install the brave permission icon decoration; returns the disposer. */
export function installBravePermissionIcon(document: Document): () => void {
  // Remove only this decorator's own style tag, never a sibling Aris style
  // (e.g. the thinking-display stylesheet) that shares the plugin id.
  for (const existing of document.querySelectorAll(`style[data-plugin-css="${PLUGIN_CSS}"]`)) {
    existing.remove()
  }

  const style = document.createElement('style')
  style.dataset.plugin = PLUGIN_ID
  style.dataset.pluginCss = PLUGIN_CSS
  style.textContent = iconStyles()
  document.head.appendChild(style)

  let active = true
  let queued = false
  const scan = (): void => {
    if (!active || queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      if (active) decorateBravePermissionIcons(document)
    })
  }

  decorateBravePermissionIcons(document)
  const observer = new MutationObserver(scan)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-label'],
    characterData: true,
    childList: true,
    subtree: true,
  })

  return () => {
    active = false
    observer.disconnect()
    style.remove()
    for (const marked of document.querySelectorAll(`[${ICON_ATTRIBUTE}]`)) {
      marked.removeAttribute(ICON_ATTRIBUTE)
    }
  }
}
