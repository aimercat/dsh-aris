import { useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { CardForm, booleanField, type CardActions, type CardFieldState, type CardShell } from './card-form.ts'

export interface ArisLive2DSettings {
  muted?: boolean
  allowMotionSound?: boolean
  defaultHidden?: boolean
}

export interface ArisLive2DSettingsCardState extends CardShell {
  muted: CardFieldState
  allowMotionSound: CardFieldState
  defaultHidden: CardFieldState
}

export interface ArisLive2DSettingsCardFace extends CardActions {
  hooks: {
    arisLive2DSettingsCard: SnapshotStore<ArisLive2DSettingsCardState>
  }
}

export interface SettingsPluginItemOwnerProps {
  children?: never
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'settings.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

export class ArisLive2DSettingsCardController {
  private readonly form: CardForm<ArisLive2DSettings>
  private readonly store: SnapshotStore<ArisLive2DSettingsCardState>

  constructor(scope: import('@deepseek-ai/dsh-client-runtime/client').SettingsScope<ArisLive2DSettings>) {
    this.form = new CardForm(scope, [
      booleanField('muted'),
      booleanField('allowMotionSound'),
      booleanField('defaultHidden'),
    ])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): ArisLive2DSettingsCardState {
    return {
      ...this.form.shell(),
      muted: this.form.field('muted'),
      allowMotionSound: this.form.field('allowMotionSound'),
      defaultHidden: this.form.field('defaultHidden'),
    }
  }

  inject(): ArisLive2DSettingsCardFace {
    return { hooks: { arisLive2DSettingsCard: this.store }, ...this.form.actions() }
  }
}

export type ArisLive2DSettingsCardProps =
  PropsRuntime<'settings.plugin.item'>
  & InjectFace<ArisLive2DSettingsCardFace>

export function ArisLive2DSettingsCard(props: ArisLive2DSettingsCardProps) {
  const [open, setOpen] = useState(false)
  const useCard = (props as ArisLive2DSettingsCardProps & { useArisLive2DSettingsCard?: (selector: (value: ArisLive2DSettingsCardState) => ArisLive2DSettingsCardState) => ArisLive2DSettingsCardState }).useArisLive2DSettingsCard
  if (typeof useCard !== 'function') {
    return (
      <li className="aris-settings-card is-open">
        <div className="aris-settings-card__body">
          <p className="aris-settings-card__label">爱丽丝 Live2D 设置卡注入失败</p>
          <p className="aris-settings-card__hint">slot 已渲染，但 useArisLive2DSettingsCard hook 未注入到组件 props。</p>
        </div>
      </li>
    )
  }
  const state = useCard(snapshot => snapshot)
  const blocked = !state.dirty || state.invalid || state.saving

  return (
    <li className={`aris-settings-card${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="aris-settings-card__header"
        aria-expanded={open}
        aria-label={`${open ? '收起设置' : '展开设置'}: 爱丽丝 Live2D`}
        onClick={() => { setOpen(!open) }}
      >
        <span className="aris-settings-card__head-text">
          <span className="aris-settings-card__name">爱丽丝 Live2D</span>
          <span className="aris-settings-card__description">语音与默认显示行为。</span>
        </span>
        {state.dirty ? <span className="aris-settings-card__pending">未保存</span> : null}
        <span className={`aris-settings-card__chevron${open ? ' is-open' : ''}`}>▾</span>
      </button>
      {open ? (
        <div className="aris-settings-card__body">
          {!state.exposed ? <p className="aris-settings-card__notice">当前部署未向设置页暴露爱丽丝 Live2D 设置命名空间。</p> : null}
          {state.exposed ? (
            <>
              {!state.writable ? <p className="aris-settings-card__notice">当前设置为只读。</p> : null}
              <BooleanField
                id="settings-aris-muted"
                label="默认静音"
                hint="进入会话时是否默认静音爱丽丝模型语音。"
                inheritLabel="继承"
                onLabel="开"
                offLabel="关"
                overriddenLabel="已覆盖"
                resetLabel="恢复默认"
                disabled={!state.writable}
                {...state.muted}
                onEdit={(text) => { props.edit('muted', text) }}
                onReset={() => { props.resetField('muted') }}
              />
              <BooleanField
                id="settings-aris-allow-motion-sound"
                label="允许动作语音"
                hint="是否允许播放模型 motion 自带音频。"
                inheritLabel="继承"
                onLabel="开"
                offLabel="关"
                overriddenLabel="已覆盖"
                resetLabel="恢复默认"
                disabled={!state.writable}
                {...state.allowMotionSound}
                onEdit={(text) => { props.edit('allowMotionSound', text) }}
                onReset={() => { props.resetField('allowMotionSound') }}
              />
              <BooleanField
                id="settings-aris-default-hidden"
                label="默认折叠"
                hint="进入会话时是否默认以折叠 launcher 形态显示。"
                inheritLabel="继承"
                onLabel="开"
                offLabel="关"
                overriddenLabel="已覆盖"
                resetLabel="恢复默认"
                disabled={!state.writable}
                {...state.defaultHidden}
                onEdit={(text) => { props.edit('defaultHidden', text) }}
                onReset={() => { props.resetField('defaultHidden') }}
              />
              <div className="aris-settings-card__footer">
                {state.failed ? <p className="aris-settings-card__notice">保存失败，请检查设置值后重试。</p> : null}
                <button type="button" className="aris-settings-card__action" disabled={!state.dirty || state.saving} onClick={props.discard}>放弃</button>
                <button type="button" className="aris-settings-card__action aris-settings-card__action--primary" disabled={blocked} onClick={props.save}>{!state.saving ? '保存' : '保存中…'}</button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

interface BooleanFieldProps extends CardFieldState {
  id: string
  label: string
  hint: string
  inheritLabel: string
  onLabel: string
  offLabel: string
  overriddenLabel: string
  resetLabel: string
  disabled: boolean
  onEdit: (text: string) => void
  onReset: () => void
}

function BooleanField(props: BooleanFieldProps) {
  const value = props.text === 'true'
  const inherited = props.text === ''
  return (
    <div className="aris-settings-card__field">
      <div className="aris-settings-card__field-head">
        <div>
          <label className="aris-settings-card__label" htmlFor={props.id}>{props.label}</label>
          <p className="aris-settings-card__hint">{props.hint}</p>
        </div>
        {props.overridden ? (
          <span className="aris-settings-card__badges">
            <span className="aris-settings-card__badge">{props.overriddenLabel}</span>
            <button type="button" className="aris-settings-card__reset" disabled={props.disabled} onClick={props.onReset}>{props.resetLabel}</button>
          </span>
        ) : null}
      </div>
      <div className="aris-settings-card__boolean-row">
        <button id={props.id} type="button" className={`aris-settings-card__boolean${!inherited && value ? ' is-on' : ''}`} disabled={props.disabled} onClick={() => { props.onEdit('true') }}>{props.onLabel}</button>
        <button type="button" className={`aris-settings-card__boolean${!inherited && !value ? ' is-on' : ''}`} disabled={props.disabled} onClick={() => { props.onEdit('false') }}>{props.offLabel}</button>
        <button type="button" className={`aris-settings-card__boolean${inherited ? ' is-on' : ''}`} disabled={props.disabled} onClick={() => { props.onEdit('') }}>{props.inheritLabel}</button>
      </div>
    </div>
  )
}
