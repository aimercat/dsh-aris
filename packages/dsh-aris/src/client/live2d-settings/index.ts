import type { ClientContext, SettingsScope, SettingsScopeSnapshot, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { ArisLive2DSettingsCard, ArisLive2DSettingsCardController, type ArisLive2DSettings } from './card.tsx'
import { NS, en, zh } from './locales.ts'

const SETTINGS_NAMESPACE = 'aris-live2d'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** rc.6-compatible settings binder from @aimercat/dsh-aris-settings. */
    arisSettings?: {
      bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S>
    }
    /** The dsh-web-ui family's equivalent binder (optional coexistence). */
    webUiSettings?: {
      bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S>
    }
  }
}

/**
 * An unavailable settings scope used when no binder is available. The card
 * renders its read-only explanation instead of disappearing (or crashing).
 */
function createUnavailableScope<T>(): SettingsScope<T> {
  const snapshot: SettingsScopeSnapshot<T> = {
    status: 'unavailable',
    value: undefined,
    base: undefined,
    user: undefined,
    revision: undefined,
    writable: false,
    mode: 'host',
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: async () => {},
    unset: async () => {},
  }
}

export function registerArisLive2DSettingsCard(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'aris-settings: dictionaries')

  // Prefer the Aris family binder (bridge fallback), then the dsh-web-ui
  // family's, then the official scope. Standalone installs without any
  // binder fall back to a pending scope so the card still renders its
  // explanation instead of vanishing.
  const binder = ctx.get('arisSettings') ?? ctx.get('webUiSettings') ?? ctx.get('settingsScope')
  const settingsScope = binder === undefined
    ? createUnavailableScope<ArisLive2DSettings>()
    : binder.bind<ArisLive2DSettings>({ namespace: SETTINGS_NAMESPACE })
  const card = new ArisLive2DSettingsCardController(settingsScope)

  const registerCard = (slot: 'aris.plugin.item' | 'settings.plugin.item'): (() => void) => ctx.slots.register({
    name: slot,
    id: 'aris-live2d-settings',
    order: 155,
    locale: NS,
    inject: () => card.inject(),
  }, ArisLive2DSettingsCard)

  // Dual-slot adaptive registration:
  // - Top-level fallback: standalone installs (no family group host) render
  //   the card directly in the settings page, like pre-aggregate builds.
  // - Group migration: when @aimercat/dsh-aris-settings later declares the
  //   aris.plugin.item child slot (declaration-aware inject), the top-level
  //   card is disposed and the card re-registers inside the family group.
  // Order between the two plugins does not matter: whichever slot is declared
  // first wins the card, and the other inject collapses it.
  const disposeTop = ctx.slots.inject('settings.plugin.item', () => registerCard('settings.plugin.item'))
  ctx.slots.inject('aris.plugin.item', () => {
    disposeTop()
    return registerCard('aris.plugin.item')
  })
}
