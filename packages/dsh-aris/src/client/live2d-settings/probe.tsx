import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

export type ArisSettingsProbeProps = PropsRuntime<'settings.plugin.item'>

export function ArisSettingsProbe(_props: ArisSettingsProbeProps) {
  return (
    <li className="aris-settings-card is-open">
      <div className="aris-settings-card__body">
        <p className="aris-settings-card__label">爱丽丝 Live2D 调试卡</p>
        <p className="aris-settings-card__hint">如果老师能看到这张卡，说明 settings.plugin.item 渲染链是通的，问题在设置卡自己的注入/状态逻辑。</p>
      </div>
    </li>
  )
}
