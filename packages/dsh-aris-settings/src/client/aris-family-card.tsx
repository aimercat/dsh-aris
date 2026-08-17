/**
 * The Aris family group card. Renders as one item in the
 * `settings.plugin.item` list and, when expanded, renders every family
 * plugin card into its own child slot. The card chrome mirrors the official
 * ui-plugin-config PluginCard so the group reads as a sibling of the built-in
 * Shell / Agent loop / Web search cards, with the Aris blue as the accent.
 */

import { useState, type ReactNode } from 'react'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import type { ArisFamilySettingsKey } from './locales.ts'

/** Owner share of the group card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Props the group card binds. */
export interface ArisFamilyCardProps {
  /** Locale reader for this card's copy. */
  t: (key: ArisFamilySettingsKey) => string
  /** Runtime slot rendering for the family plugin cards. */
  renderSlot: PropsRenderSlots<'aris.plugin.item'>['renderSlot']
}

/**
 * Render the group card with the child plugin cards inside its body.
 * @param props - locale copy and the child slot renderer.
 * @returns the group card, or nothing when the section does not exist.
 */
export function ArisFamilyCard(props: ArisFamilyCardProps): ReactNode {
  const { t, renderSlot } = props
  const [open, setOpen] = useState(false)
  return (
    <li className={`aris-family-card${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="aris-family-card__header"
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className="aris-family-card__mark" aria-hidden="true" />
        <span className="aris-family-card__head-text">
          <span className="aris-family-card__name" title={t('title')}>{t('title')}</span>
          <span className="aris-family-card__description" title={t('description')}>{t('description')}</span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`aris-family-card__chevron${open ? ' is-open' : ''}`}
        >
          <path
            d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 9.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z"
            fill="currentColor"
          />
        </svg>
      </button>
      {open
        ? (
          <div className="aris-family-card__body">
            <ul className="aris-family-card__subcards">
              {renderSlot('aris.plugin.item', {}, { fallback: <li className="aris-family-card__empty">{t('empty')}</li> })}
            </ul>
          </div>
        )
        : null}
    </li>
  )
}
