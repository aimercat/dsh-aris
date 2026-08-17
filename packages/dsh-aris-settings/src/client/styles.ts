/**
 * Aris family group card styles — injected as one <style> tag by the client
 * half. The chrome mirrors the official ui-settings-plugins PluginCard
 * tokens so the group reads as a sibling of the built-in cards; the left
 * mark and the accent states use the Aris blue.
 */

export const FAMILY_CARD_STYLE_TAG_ID = 'aris-family-card-css'

export const FAMILY_CARD_CSS = `
.aris-family-card {
  list-style: none;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-3);
  border-radius: 12px;
  transition: border-color 0.16s, background 0.16s;
}
.aris-family-card:hover {
  border-color: var(--dsw-alias-label-dimmed);
}
.aris-family-card.is-open {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-label-dimmed);
}
.aris-family-card__header {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.aris-family-card__header:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.aris-family-card__mark {
  flex: none;
  width: 4px;
  align-self: stretch;
  border-radius: 2px;
  background: #4a9eff;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.45);
}
.aris-family-card__head-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 4px;
  min-width: 0;
}
.aris-family-card__name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary);
}
.aris-family-card__description {
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.aris-family-card__chevron {
  color: var(--dsw-alias-label-tertiary);
  flex: none;
  transition: transform 0.16s;
}
.aris-family-card__chevron.is-open {
  transform: rotate(180deg);
}
.aris-family-card__body {
  border-top: 1px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding: 12px 0 8px;
}
.aris-family-card__subcards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.aris-family-card__empty {
  margin: 0;
  padding: 8px 2px;
  font-size: 13px;
  color: var(--dsw-alias-label-tertiary);
}
@media (prefers-reduced-motion: reduce) {
  .aris-family-card,
  .aris-family-card__header,
  .aris-family-card__chevron {
    transition: none;
  }
}
`
