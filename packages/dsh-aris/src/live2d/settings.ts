import Schema from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

export const ARIS_LIVE2D_SETTINGS_NAMESPACE = 'aris-live2d'
export const ARIS_LIVE2D_SETTINGS_NS = settingsNamespace(ARIS_LIVE2D_SETTINGS_NAMESPACE)

export interface ArisLive2DSettingsSection {
  enabled: boolean
  muted: boolean
  allowMotionSound: boolean
  defaultHidden: boolean
}

export const ArisLive2DSettingsSchema = Schema.object({
  enabled: Schema.boolean().default(true).description('是否启用爱丽丝 Live2D。关闭后会完全隐藏模型与折叠 launcher，并停用相关功能。'),
  muted: Schema.boolean().default(false).description('是否默认静音爱丽丝模型音频。'),
  allowMotionSound: Schema.boolean().default(true).description('是否允许播放 motion 自带音频。'),
  defaultHidden: Schema.boolean().default(false).description('是否默认以折叠 launcher 形态显示。'),
})
