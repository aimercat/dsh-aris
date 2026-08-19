/**
 * Prompt navigation dictionary — browser half.
 * @module aris-prompt-nav/locales
 */

export const NS = 'aris-prompt-nav' as const

export const zh = {
  'nav.toggle': '提示词导航',
  'nav.toggleHint': '展开爱丽丝的提示词导航面板',
  'nav.close': '收起提示词导航',
  'nav.title': '提示词导航',
  'nav.subtitle': '爱丽丝的冒险地图',
  'nav.empty': '暂无提示词，勇士的冒险尚未开始。',
  'nav.steering': '插入',
} as const

export const en = {
  'nav.toggle': 'Prompt navigation',
  'nav.toggleHint': 'Open Aris prompt navigation',
  'nav.close': 'Close prompt navigation',
  'nav.title': 'Prompt Navigation',
  'nav.subtitle': "Aris's adventure map",
  'nav.empty': 'No prompts yet — the adventure has not begun.',
  'nav.steering': 'Steering',
} as const

export type PromptNavKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'aris-prompt-nav': PromptNavKey
  }
}
