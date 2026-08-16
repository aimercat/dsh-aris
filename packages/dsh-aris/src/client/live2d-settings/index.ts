import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { ArisLive2DSettingsCard, ArisLive2DSettingsCardController, type ArisLive2DSettings } from './card.tsx'

const SETTINGS_NAMESPACE = 'aris-live2d'

declare module '@deepseek-ai/cordis' {
  interface Context {
    webUiSettings?: {
      bind<S>(spec: import('@deepseek-ai/dsh-client-runtime/client').SettingsScopeSpec<S>): import('@deepseek-ai/dsh-client-runtime/client').SettingsScope<S>
    }
  }
}

export function registerArisLive2DSettingsCard(ctx: ClientContext): void {
  const binder = ctx.webUiSettings ?? ctx.settingsScope
  const settingsScope = binder.bind<ArisLive2DSettings>({ namespace: SETTINGS_NAMESPACE })
  const card = new ArisLive2DSettingsCardController(settingsScope)

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    id: 'aris-live2d-settings',
    order: 155,
    inject: () => card.inject(),
  }, ArisLive2DSettingsCard))
}
