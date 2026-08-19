/**
 * Prompt navigation header toggle — browser half.
 *
 * Registers one button into the official `conversation.session.header.actions`
 * list slot (declared by @deepseek-ai/dsh-client-ui-conversation, imported
 * type-only): an Aris-styled 光之剑 glyph beside the session title.
 *
 * Behavior contract:
 * - Only exists while the followed session runs an Aris preset (controller
 *   store gate) — non-Aris sessions render nothing.
 * - Clicking opens the panel AND hides the button; closing the panel brings
 *   the button back (the panel owns its own close affordance).
 *
 * Registration is declaration-aware (`ctx.slots.inject`): the entry waits
 * for the official header slot to be declared and collapses cleanly with it,
 * exactly like the live2d-settings dual-slot pattern.
 * @module aris-prompt-nav/toggle
 */

import type { ClientContext, SessionId, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PromptNavController, PromptNavState } from './index.ts'
import { NS, en, zh } from './locales.ts'
import { NAV_COUNT_CLASS, NAV_TOGGLE_CLASS } from './styles.ts'

/** Business face injected by the controller into the slot entry. */
export interface PromptNavFace {
  hooks: {
    promptNav: SnapshotStore<PromptNavState>
  }
  toggle: (sessionId: SessionId) => void
}

export type PromptNavToggleProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<typeof NS>
  & InjectFace<PromptNavFace>

/** The 光之剑 glyph (same silhouette as the brave-permission icon). */
function SwordIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 0.8 9.3 2.9 8 4.1 6.7 2.9 Z" fill="currentColor" />
      <path d="M7 3.8 9 3.8 9.1 9.4 8 10.2 6.9 9.4 Z" fill="currentColor" />
      <rect x="5.3" y="10.2" width="5.4" height="1.3" rx="0.65" fill="currentColor" />
      <rect x="7.2" y="11.5" width="1.6" height="2.4" rx="0.8" fill="currentColor" />
      <circle cx="8" cy="14.5" r="1" fill="currentColor" />
    </svg>
  )
}

export function PromptNavToggle(props: PromptNavToggleProps) {
  const { t } = props
  const state = props.usePromptNav(snapshot => snapshot)
  // Aris gate: the controller only follows Aris sessions; a header belonging
  // to any other session (or a stale store beat) renders nothing. The button
  // also disappears while the panel is open — the panel is its expanded form.
  if (!state.enabled || state.sessionId !== props.sessionId || state.open) return null
  return (
    <button
      type="button"
      className={NAV_TOGGLE_CLASS}
      aria-pressed={false}
      aria-label={t('nav.toggle')}
      title={t('nav.toggle')}
      onClick={() => { props.toggle(props.sessionId) }}
    >
      <SwordIcon />
      {state.count > 0 ? (
        <span className={NAV_COUNT_CLASS}>{state.count > 99 ? '99+' : state.count}</span>
      ) : null}
    </button>
  )
}

/**
 * Register the toggle into the official session header action slot.
 * @param controller - the prompt navigation controller (inject + toggle face).
 * @returns disposer (cancels the declaration wait and the registration).
 */
export function registerPromptNavToggle(ctx: ClientContext, controller: PromptNavController): () => void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'aris-prompt-nav: dictionaries')
  return ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'aris-prompt-nav',
    order: 40,
    locale: NS,
    inject: () => controller.inject(),
  }, PromptNavToggle))
}
