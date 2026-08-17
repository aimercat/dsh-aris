import type { ClientContext, SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client'
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

export function registerArisLive2DSettingsCard(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'aris-settings: dictionaries')

  // Prefer the Aris family binder (bridge fallback), then the dsh-web-ui
  // family's, then the official scope. Standalone installs without any
  // binder keep the card read-only instead of crashing.
  const binder = ctx.arisSettings ?? ctx.webUiSettings ?? ctx.settingsScope
  const settingsScope = binder.bind<ArisLive2DSettings>({ namespace: SETTINGS_NAMESPACE })
  const card = new ArisLive2DSettingsCardController(settingsScope)

  // Declaration-aware: runs only when the Aris family group card
  // (@aimercat/dsh-aris-settings) declared the aris.plugin.item child slot;
  // standalone installs keep the card silently absent.
  ctx.slots.inject('aris.plugin.item', () => ctx.slots.register({
    name: 'aris.plugin.item',
    id: 'aris-live2d-settings',
    order: 155,
    locale: NS,
    inject: () => card.inject(),
  }, ArisLive2DSettingsCard))
}
