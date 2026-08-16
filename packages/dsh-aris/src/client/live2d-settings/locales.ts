export const NS = 'aris-settings' as const

export const zh = {
  'plugin.title': '爱丽丝插件',
  'plugin.description': '爱丽丝会话伴随与 Live2D 配置。',
  'plugin.expand': '展开设置',
  'plugin.collapse': '收起设置',
  'plugin.unsaved': '未保存',
  'plugin.notExposed': '当前部署未向设置页暴露爱丽丝插件配置命名空间。',
  'plugin.readOnly': '当前设置为只读。',
  'plugin.saveFailed': '保存失败，请检查设置值后重试。',
  'plugin.discard': '放弃',
  'plugin.save': '保存',
  'plugin.saving': '保存中…',
  'plugin.overridden': '已覆盖',
  'plugin.reset': '恢复默认',
  'plugin.inherit': '继承',
  'plugin.on': '开',
  'plugin.off': '关',
  'live2d.title': '爱丽丝 Live2D',
  'live2d.description': '语音与默认显示行为。',
  'live2d.muted': '默认静音',
  'live2d.mutedHint': '进入会话时是否默认静音爱丽丝模型音频。',
  'live2d.allowMotionSound': '允许动作语音',
  'live2d.allowMotionSoundHint': '是否允许播放模型 motion 自带音频。',
  'live2d.defaultHidden': '默认折叠',
  'live2d.defaultHiddenHint': '进入会话时是否默认以折叠 launcher 形态显示。',
} as const

export const en = {
  'plugin.title': 'Aris Plugin',
  'plugin.description': 'Session companion and Live2D configuration for Aris.',
  'plugin.expand': 'Show settings',
  'plugin.collapse': 'Hide settings',
  'plugin.unsaved': 'Unsaved',
  'plugin.notExposed': 'This deployment does not expose the Aris plugin settings namespace to the settings page.',
  'plugin.readOnly': 'This settings document is read-only.',
  'plugin.saveFailed': 'Save failed. Check the values and try again.',
  'plugin.discard': 'Discard',
  'plugin.save': 'Save',
  'plugin.saving': 'Saving…',
  'plugin.overridden': 'Overridden',
  'plugin.reset': 'Reset',
  'plugin.inherit': 'Inherit',
  'plugin.on': 'On',
  'plugin.off': 'Off',
  'live2d.title': 'Aris Live2D',
  'live2d.description': 'Voice and default display behavior.',
  'live2d.muted': 'Muted by default',
  'live2d.mutedHint': 'Whether Aris starts muted when the session opens.',
  'live2d.allowMotionSound': 'Allow motion voice',
  'live2d.allowMotionSoundHint': 'Whether model motion audio is allowed to play.',
  'live2d.defaultHidden': 'Hidden by default',
  'live2d.defaultHiddenHint': 'Whether Aris starts as a compact launcher.',
} as const

export type ArisSettingsKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'aris-settings': ArisSettingsKey
  }
}
