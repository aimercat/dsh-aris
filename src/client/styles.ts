/**
 * Aris thinking-display styles — injected as one <style> tag only while the
 * active session runs the `aris` preset, removed on disable so other presets
 * stay untouched.
 *
 * Anchoring: the reasoning block is rendered by the official ReasoningRow
 * component (ui-conversation). Its CSS-Module class names are hashed and
 * unstable, so every rule selects through the stable `data-variant="think"`
 * attribute and substring class matches ([class*="title"] etc.). The "Think"
 * disclosure title is replaced via the visibility + ::after trick because a
 * plain textContent patch would be reverted by React reconciliation; the
 * pseudo-element text React never sees.
 * @module aris-think/styles
 */

export const STYLE_TAG_ID = 'aris-think-css'

/** Sectionized body: marker attribute set after folding. */
export const SECTION_ATTR = 'data-aris-sectionized'

/** One paragraph fold, appended into the think body. */
export const SECTION_CLASS = 'aris-think-section'

export const CSS = `
/* ── title: 「Think」→「爱丽丝的思考回路」 ─────────────────────────────── */
[data-variant="think"] [class*="title"] {
  visibility: hidden;
  position: relative;
  /* Room for the longer replacement title so it never overflows onto the
     disclosure summary beside it. */
  min-width: 8.5em;
}
[data-variant="think"] [class*="title"]::after {
  content: '爱丽丝的思考回路';
  visibility: visible;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  white-space: nowrap;
  font-weight: 600;
  color: #4a9eff;
  pointer-events: none;
}

/* ── typewriter caret on the streaming summary ──────────────────────────── */
[data-variant="think"][data-state="running"] [class*="summary"]::after {
  content: '▍';
  margin-left: 2px;
  color: #4a9eff;
  animation: aris-think-blink 0.9s steps(2, start) infinite;
}
@keyframes aris-think-blink {
  to { visibility: hidden; }
}

/* ── sectionized (folded) thinking body ─────────────────────────────────── */
.${SECTION_CLASS} {
  margin: 4px 0;
  border-radius: 8px;
  background: rgba(74, 158, 255, 0.06);
}
.${SECTION_CLASS} > summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: #4a9eff;
  user-select: none;
}
.${SECTION_CLASS} > summary::-webkit-details-marker {
  display: none;
}
.${SECTION_CLASS} > summary::before {
  content: '▸';
  transition: transform 0.15s ease;
  font-size: 10px;
}
.${SECTION_CLASS}[open] > summary::before {
  transform: rotate(90deg);
}
.${SECTION_CLASS}-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.${SECTION_CLASS}-body {
  padding: 2px 12px 10px;
  white-space: pre-wrap;
}
`
