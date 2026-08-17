/**
 * The `aris-family-settings` locale dictionaries for the family group card.
 * (Namespace deliberately distinct from dsh-aris's own `aris-settings`.)
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '爱丽丝全家桶',
  'description': '统一管理 dsh-aris 家族插件的启用与配置。',
  'expand': '展开',
  'collapse': '收起',
  'empty': '没有已安装的 dsh-aris 家族插件。',
  'notExposed': '配置命名空间尚未对客户端开放，表单只读。',
} satisfies Record<string, string>

/** Key union for this namespace. */
export type ArisFamilySettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Aris Family',
  'description': 'Enable and configure the dsh-aris family plugins from one place.',
  'expand': 'Show plugins',
  'collapse': 'Hide plugins',
  'empty': 'No dsh-aris family plugins installed.',
  'notExposed': 'Settings namespace is not exposed to configuration clients; the form is read-only.',
} satisfies Record<ArisFamilySettingsKey, string>
