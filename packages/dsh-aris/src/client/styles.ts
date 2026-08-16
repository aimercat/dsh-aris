/**
 * Aris browser-half styles — injected as one <style> tag only while the
 * active session runs the `aris` preset.
 *
 * @module aris-think/styles
 */

export const STYLE_TAG_ID = 'aris-think-css'
export const SECTION_ATTR = 'data-aris-sectionized'
export const SECTION_CLASS = 'aris-think-section'

export const CSS = `
/* -- title: "Think" -> "爱丽丝的思考回路" ----------------------------- */
[data-variant="think"] [class*="title"] {
  visibility: hidden;
  position: relative;
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

/* -- typewriter caret on the streaming summary --------------------------- */
[data-variant="think"][data-state="running"] [class*="summary"]::after {
  content: '▍';
  margin-left: 2px;
  color: #4a9eff;
  animation: aris-think-blink 0.9s steps(2, start) infinite;
}
@keyframes aris-think-blink {
  to { visibility: hidden; }
}

/* -- sectionized (folded) thinking body --------------------------------- */
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

/* -- live2d overlay ------------------------------------------------------ */
[data-dsh-aris-live2d] {
  position: fixed;
  z-index: 40;
  width: 320px;
  height: 420px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  transform-origin: left top;
  transform: scale(var(--aris-live2d-scale, 1));
  border-radius: 12px;
  outline: 1px solid rgba(93, 162, 255, 0.22);
}
[data-dsh-aris-live2d][data-hidden="1"] {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  outline: none;
}
[data-dsh-aris-live2d][data-hidden="1"] .aris-live2d-stage,
[data-dsh-aris-live2d][data-hidden="1"] .aris-live2d-bubble,
[data-dsh-aris-live2d][data-hidden="1"] .aris-live2d-mute,
[data-dsh-aris-live2d][data-hidden="1"] .aris-live2d-reset {
  display: none;
}
.aris-live2d-stage {
  width: 320px;
  height: 420px;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: rgba(159, 208, 255, 0.85);
  font-size: 12px;
  border-radius: 12px;
  background: radial-gradient(circle at top, rgba(70, 128, 214, 0.08), rgba(9, 17, 30, 0.05));
}
.aris-live2d-stage[data-stage-state="failed"] {
  color: #ffd6c2;
  border: 1px solid rgba(255, 166, 87, 0.45);
}
.aris-live2d-stage[data-stage-state="core-ready"] {
  color: #d6e8ff;
}
.aris-live2d-stage canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.aris-live2d-toggle,
.aris-live2d-mute,
.aris-live2d-reset {
  position: absolute;
  top: 6px;
  z-index: 2;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(116, 181, 255, 0.4);
  background: rgba(9, 17, 30, 0.68);
  color: #9fd0ff;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.aris-live2d-toggle {
  left: 6px;
}
.aris-live2d-mute {
  left: 34px;
}
.aris-live2d-reset {
  left: 62px;
}
.aris-live2d-bubble {
  position: absolute;
  right: 18px;
  top: 38px;
  max-width: 220px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(9, 17, 30, 0.9);
  color: #eef6ff;
  border: 1px solid rgba(116, 181, 255, 0.35);
  font-size: 12px;
  line-height: 1.45;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
}
.aris-live2d-bubble[data-tone="happy"] {
  border-color: rgba(94, 230, 180, 0.45);
}
.aris-live2d-bubble[data-tone="warning"] {
  border-color: rgba(255, 166, 87, 0.55);
}
.aris-live2d-bubble[data-tone="thinking"] {
  border-color: rgba(132, 170, 255, 0.5);
}
.aris-live2d-bubble[data-tone="victory"] {
  border-color: rgba(255, 223, 107, 0.55);
}
`