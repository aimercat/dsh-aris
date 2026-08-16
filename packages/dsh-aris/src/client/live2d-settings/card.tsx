import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
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
  & PropsLocale<'aris-settings'>
  & InjectFace<ArisLive2DSettingsCardFace>

export function ArisLive2DSettingsCard(props: ArisLive2DSettingsCardProps) {
  const { t } = props
  const [open, setOpen] = useState(false)
  const [live2dOpen, setLive2dOpen] = useState(true)
  const state = props.useArisLive2DSettingsCard(snapshot => snapshot)
  const blocked = !state.dirty || state.invalid || state.saving

  return (
    <li className={`aris-settings-card${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="aris-settings-card__header"
        aria-expanded={open}
        aria-label={`${t(open ? 'plugin.collapse' : 'plugin.expand')}: ${t('plugin.title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className="aris-settings-card__head-text">
          <span className="aris-settings-card__name">{t('plugin.title')}</span>
          <span className="aris-settings-card__description">{t('plugin.description')}</span>
        </span>
        {state.dirty ? <span className="aris-settings-card__pending">{t('plugin.unsaved')}</span> : null}
        <Chevron className={`aris-settings-card__chevron${open ? ' is-open' : ''}`} />
      </button>
      {open ? (
        <div className="aris-settings-card__body">
          <div className={`aris-settings-card__subcard${live2dOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="aris-settings-card__subheader"
              aria-expanded={live2dOpen}
              aria-label={`${t(live2dOpen ? 'plugin.collapse' : 'plugin.expand')}: ${t('live2d.title')}`}
              onClick={() => { setLive2dOpen(!live2dOpen) }}
            >
              <span className="aris-settings-card__head-text">
                <span className="aris-settings-card__name aris-settings-card__name--sub">{t('live2d.title')}</span>
                <span className="aris-settings-card__description">{t('live2d.description')}</span>
              </span>
              <Chevron className={`aris-settings-card__chevron${live2dOpen ? ' is-open' : ''}`} />
            </button>
            {live2dOpen ? (
              <div className="aris-settings-card__subbody">
                {!state.exposed ? <p className="aris-settings-card__notice">{t('plugin.notExposed')}</p> : null}
                {state.exposed ? (
                  <>
                    {!state.writable ? <p className="aris-settings-card__notice">{t('plugin.readOnly')}</p> : null}
                    <BooleanField
                      id="settings-aris-muted"
                      label={t('live2d.muted')}
                      hint={t('live2d.mutedHint')}
                      inheritLabel={t('plugin.inherit')}
                      onLabel={t('plugin.on')}
                      offLabel={t('plugin.off')}
                      overriddenLabel={t('plugin.overridden')}
                      resetLabel={t('plugin.reset')}
                      disabled={!state.writable}
                      {...state.muted}
                      onEdit={(text) => { props.edit('muted', text) }}
                      onReset={() => { props.resetField('muted') }}
                    />
                    <BooleanField
                      id="settings-aris-motion-sound"
                      label={t('live2d.allowMotionSound')}
                      hint={t('live2d.allowMotionSoundHint')}
                      inheritLabel={t('plugin.inherit')}
                      onLabel={t('plugin.on')}
                      offLabel={t('plugin.off')}
                      overriddenLabel={t('plugin.overridden')}
                      resetLabel={t('plugin.reset')}
                      disabled={!state.writable}
                      {...state.allowMotionSound}
                      onEdit={(text) => { props.edit('allowMotionSound', text) }}
                      onReset={() => { props.resetField('allowMotionSound') }}
                    />
                    <BooleanField
                      id="settings-aris-default-hidden"
                      label={t('live2d.defaultHidden')}
                      hint={t('live2d.defaultHiddenHint')}
                      inheritLabel={t('plugin.inherit')}
                      onLabel={t('plugin.on')}
                      offLabel={t('plugin.off')}
                      overriddenLabel={t('plugin.overridden')}
                      resetLabel={t('plugin.reset')}
                      disabled={!state.writable}
                      {...state.defaultHidden}
                      onEdit={(text) => { props.edit('defaultHidden', text) }}
                      onReset={() => { props.resetField('defaultHidden') }}
                    />
                    <div className="aris-settings-card__footer">
                      <button type="button" className="aris-settings-card__action" disabled={!state.dirty || state.saving} onClick={props.discard}>{t('plugin.discard')}</button>
                      <button type="button" className="aris-settings-card__action aris-settings-card__action--primary" disabled={blocked} onClick={props.save}>{t(state.saving ? 'plugin.saving' : 'plugin.save')}</button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  )
}

function Chevron(props: { className: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
    >
      <path
        d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
        fill="currentColor"
      />
    </svg>
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
  const inherited = !props.overridden
  const value = props.text === 'true'

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
