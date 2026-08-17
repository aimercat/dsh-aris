/**
 * Aris family settings group, browser half. Registers the `aris-family-settings`
 * dictionaries and one group card into the plugin-configuration section. The
 * group card declares the `aris.plugin.item` child slot; the dsh-aris family
 * plugins register their per-plugin cards there, so the settings page shows a
 * single Aris Family entry instead of one top-level card per family plugin.
 * Also provides the `arisSettings` rc.6 compatibility binder (bridge fallback
 * over the official settings scope) that family plugin cards read through.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface SlotMap merge (the 'settings.section'
// entry) and the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { ArisSettingsBinder } from './compat-settings-scope.ts'
import { ArisFamilyCard } from './aris-family-card.tsx'
import { en, zh, type ArisFamilySettingsKey } from './locales.ts'
import { FAMILY_CARD_CSS, FAMILY_CARD_STYLE_TAG_ID } from './styles.ts'

export type { ArisFamilyCardProps } from './aris-family-card.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Aris family group card copy. */
    'aris-family-settings': ArisFamilySettingsKey
  }

  interface SlotMap {
    /**
     * The child slot one family plugin card registers into, declared by the
     * group card. Shape mirrors `settings.plugin.item` so the family plugins
     * can reuse their existing card implementations.
     */
    'aris.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
    /**
     * The plugin configuration section's card seat, declared by
     * ui-plugin-config. Spelled here with the same shape so this package can
     * register its group card without depending on the sibling UI package.
     */
    'settings.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the group card supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Required services. */
export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'remote'] as const

/**
 * Register the Aris family group.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  injectStyle()
  ctx.effect(() => ctx.locale.register('aris-family-settings', { zh, en }), 'dsh-aris-settings: dictionaries')

  // The rc.6 compatibility binder: family plugins read ctx.get('arisSettings')
  // and fall back to the official settings scope on hosts that expose their
  // namespaces natively.
  new ArisSettingsBinder(ctx)

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    id: 'aris-settings',
    order: 95,
    locale: 'aris-family-settings',
    children: { 'aris.plugin.item': { kind: 'list', scope: 'root' } },
  }, ArisFamilyCard))
}

function injectStyle(): void {
  if (document.getElementById(FAMILY_CARD_STYLE_TAG_ID) !== null) return
  const tag = document.createElement('style')
  tag.id = FAMILY_CARD_STYLE_TAG_ID
  tag.dataset.plugin = '@aimercat/dsh-aris-settings'
  tag.textContent = FAMILY_CARD_CSS
  document.head.appendChild(tag)
}
