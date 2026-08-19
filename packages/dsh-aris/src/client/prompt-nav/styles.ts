/**
 * Prompt navigation panel styles — browser half.
 *
 * A standalone <style> tag (own data-plugin-css id, removed on dispose),
 * scoped under the Aris active attribute like the thinking-display CSS:
 * the panel and its toggle only exist for Aris sessions, so every rule
 * hangs off `[data-aris-active]` and non-Aris sessions keep stock rendering.
 *
 * Visual language follows the plugin's settings cards (`.aris-settings-card`
 * in styles.ts): layered surfaces from the `--dsw-alias-*` theme variables
 * (dark/light adaptive), 10-12px radii, 1px border transitions, and Aris
 * blue `#4a9eff` accents with the 光之剑 gradient (`#a6d4ff → #4fa3ff →
 * #2f7be8`) for glow details.
 *
 * Long-list ergonomics: the entry list scrolls independently (thin themed
 * scrollbar + `overscroll-behavior: contain` so wheel input never chains
 * into the chat scrollport).
 * @module aris-prompt-nav/styles
 */

import { ACTIVE_ATTR } from '../styles.ts'

export const NAV_STYLE_TAG_ID = 'aris-prompt-nav-css'
export const NAV_PLUGIN_CSS = '@aimercat/dsh-aris/prompt-nav'
/** Panel root marker (positioned fixed; geometry owned by the controller). */
export const NAV_PANEL_ATTR = 'data-aris-prompt-nav'
/** Entry marker carrying the chat node key (matches `data-chat-anchor-key`). */
export const NAV_ENTRY_ATTR = 'data-aris-prompt-key'
export const NAV_LIST_CLASS = 'aris-prompt-nav-list'
export const NAV_ENTRY_CLASS = 'aris-prompt-nav-entry'
export const NAV_ENTRY_ACTIVE_CLASS = 'aris-prompt-nav-entry--active'
export const NAV_EMPTY_CLASS = 'aris-prompt-nav-empty'
export const NAV_TOGGLE_CLASS = 'aris-prompt-nav-toggle'
export const NAV_COUNT_CLASS = 'aris-prompt-nav-count'
/** Flash applied to the target chat row while jumping. */
export const NAV_FLASH_CLASS = 'aris-prompt-nav-flash'

export const NAV_CSS = `
/* -- header toggle button ------------------------------------------- */
[${ACTIVE_ATTR}] .${NAV_TOGGLE_CLASS} {
  position: relative;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #4a9eff;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
}
[${ACTIVE_ATTR}] .${NAV_TOGGLE_CLASS}:hover {
  background: rgba(74, 158, 255, 0.1);
}
[${ACTIVE_ATTR}] .${NAV_TOGGLE_CLASS}[aria-pressed="true"] {
  background: rgba(74, 158, 255, 0.14);
  border-color: rgba(93, 162, 255, 0.5);
  box-shadow: 0 0 10px rgba(74, 158, 255, 0.35);
}
[${ACTIVE_ATTR}] .${NAV_TOGGLE_CLASS} svg {
  width: 15px;
  height: 15px;
}
[${ACTIVE_ATTR}] .${NAV_TOGGLE_CLASS} .${NAV_COUNT_CLASS} {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: linear-gradient(180deg, #4fa3ff 0%, #2f7be8 100%);
  color: #ffffff;
  font-size: 9px;
  line-height: 14px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 1px 3px rgba(7, 15, 28, 0.35);
}

/* -- floating panel (settings-card surface language) ------------------- */
/* Geometry (left/top/height) is owned by the controller: it anchors the
   panel to the conversation scrollport and shifts the chat content right
   via a padding-left on the scrollport itself. */
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] {
  position: fixed;
  z-index: 45;
  display: flex;
  flex-direction: column;
  width: 304px;
  border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(93, 162, 255, 0.22));
  background: var(--dsw-alias-bg-layer-3, rgba(11, 20, 36, 0.95));
  box-shadow: 0 16px 40px rgba(7, 15, 28, 0.32), 0 0 0 1px rgba(74, 158, 255, 0.05);
  overflow: hidden;
  backdrop-filter: blur(8px);
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .aris-prompt-nav-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(93, 162, 255, 0.16));
  background: linear-gradient(90deg, rgba(74, 158, 255, 0.1), rgba(74, 158, 255, 0.02) 65%, transparent);
  flex: none;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .aris-prompt-nav-avatar {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  /* The asset itself is already a circular cutout (transparent outside the
     circle), so it fills the round badge entirely — no square corners. */
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
  border: 1.5px solid rgba(93, 162, 255, 0.5);
  box-shadow: 0 0 10px rgba(74, 158, 255, 0.45), 0 2px 6px rgba(7, 15, 28, 0.25);
  user-select: none;
  pointer-events: none;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .aris-prompt-nav-title {
  font-size: 14px;
  font-weight: 600;
  color: #4a9eff;
  letter-spacing: 0.02em;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .aris-prompt-nav-close {
  margin-left: auto;
  align-self: center;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .aris-prompt-nav-close:hover {
  background: rgba(74, 158, 255, 0.1);
  color: #4a9eff;
}

/* -- entry list: independent scroll, themed scrollbar, no wheel chaining -- */
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_LIST_CLASS} {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scrollbar-width: thin;
  scrollbar-color: rgba(93, 162, 255, 0.35) transparent;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_LIST_CLASS}::-webkit-scrollbar {
  width: 6px;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_LIST_CLASS}::-webkit-scrollbar-track {
  background: transparent;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_LIST_CLASS}::-webkit-scrollbar-thumb {
  background: rgba(93, 162, 255, 0.35);
  border-radius: 3px;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_LIST_CLASS}::-webkit-scrollbar-thumb:hover {
  background: rgba(93, 162, 255, 0.55);
}

/* -- entries: card rows ------------------------------------------------ */
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS} {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS}:hover {
  background: rgba(74, 158, 255, 0.07);
  border-color: rgba(93, 162, 255, 0.18);
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS}:focus-visible {
  outline: 2px solid rgba(74, 158, 255, 0.7);
  outline-offset: -2px;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS}:active {
  transform: translateY(0.5px);
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS} .aris-prompt-nav-no {
  flex: none;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  color: #dcebff;
  background: linear-gradient(180deg, rgba(79, 163, 255, 0.35), rgba(47, 123, 232, 0.28));
  border: 1px solid rgba(93, 162, 255, 0.25);
  font-variant-numeric: tabular-nums;
  transition: box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS} .aris-prompt-nav-preview {
  flex: 1;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.55;
  color: var(--dsw-alias-label-secondary);
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS} .aris-prompt-nav-meta {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS} .aris-prompt-nav-time {
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS} .aris-prompt-nav-badge {
  font-size: 10px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 202, 87, 0.14);
  color: #ffd27a;
  border: 1px solid rgba(255, 202, 87, 0.35);
}

/* -- active (current scroll position) entry: strong Aris glow ------------ */
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS}.${NAV_ENTRY_ACTIVE_CLASS} {
  background: linear-gradient(180deg, rgba(74, 158, 255, 0.17), rgba(74, 158, 255, 0.08));
  border-color: rgba(93, 162, 255, 0.42);
  box-shadow: 0 0 0 1px rgba(74, 158, 255, 0.1), 0 4px 14px rgba(74, 158, 255, 0.12), inset 3px 0 0 #4a9eff;
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS}.${NAV_ENTRY_ACTIVE_CLASS} .aris-prompt-nav-no {
  background: linear-gradient(180deg, #4fa3ff 0%, #2f7be8 100%);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 0 10px rgba(74, 158, 255, 0.6);
}
[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_ENTRY_CLASS}.${NAV_ENTRY_ACTIVE_CLASS} .aris-prompt-nav-preview {
  color: var(--dsw-alias-label-primary);
}

[${ACTIVE_ATTR}] [${NAV_PANEL_ATTR}] .${NAV_EMPTY_CLASS} {
  padding: 26px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

/* -- chat row flash while jumping: double pulse + glow, unmistakable ----- */
@keyframes aris-prompt-nav-flash {
  0% { background-color: transparent; box-shadow: none; }
  15% { background-color: rgba(74, 158, 255, 0.22); box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.28), 0 0 22px rgba(74, 158, 255, 0.45); }
  35% { background-color: rgba(74, 158, 255, 0.1); box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.14), 0 0 9px rgba(74, 158, 255, 0.18); }
  55% { background-color: rgba(74, 158, 255, 0.22); box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.28), 0 0 22px rgba(74, 158, 255, 0.45); }
  80% { background-color: rgba(74, 158, 255, 0.1); box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.16), 0 0 12px rgba(74, 158, 255, 0.28); }
  100% { background-color: transparent; box-shadow: none; }
}
[${ACTIVE_ATTR}] .${NAV_FLASH_CLASS} {
  animation: aris-prompt-nav-flash 1.8s ease 1;
  border-radius: 12px;
  outline: 1px solid rgba(93, 162, 255, 0.4);
  outline-offset: -1px;
}
`
