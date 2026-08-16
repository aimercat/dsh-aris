/**
 * @aimercat/dsh-aris — Tendo Aris (天童爱丽丝) partner agent for DeepSeek Harness.
 *
 * The brave-knight persona of the Millennium game-dev club, composed as an
 * agent preset (see `preset/aris/`). The persona prose is authored in
 * `preset/aris/persona.md` (single source of truth) and inlined into the
 * preset's `agent.cordis.yml` as the `dsh-persona` text.
 *
 * This host plugin is the dedicated home for the persona's future
 * enhancements — most importantly a live2d / avatar layer that renders the
 * character beside the conversation and can be controlled from the session
 * itself. The persona stays in the preset; this host half owns config,
 * projection registration, and model-callable control tools.
 *
 * @module @aimercat/dsh-aris
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { installSettingsSection } from '@deepseek-ai/dsh-settings'
import type { ArisAvatarAnchor } from './live2d/types.ts'
import { registerArisAvatarProjection, registerArisAvatarTool } from './live2d/host.ts'
import {
  ARIS_LIVE2D_SETTINGS_NS,
  ArisLive2DSettingsSchema,
  type ArisLive2DSettingsSection,
} from './live2d/settings.ts'

/** Cordis plugin name. */
export const name = 'aris'

/** The persona identity this package owns. */
export const PERSONA_ID = 'aris'
export const PERSONA_NAME = '天童爱丽丝'

/** Required host services. */
export const inject = ['tools']

/** Model-facing plugin configuration. */
export interface Config {
  /** Whether the live2d avatar layer is enabled. */
  live2dEnabled: boolean
  /** URL or local served path to the model3/model settings file. */
  live2dModelBase: string
  /** Default corner for the first overlay placement. */
  live2dAnchor: ArisAvatarAnchor
  /** URL of the Cubism Core runtime script required by Cubism 3/4 web models. */
  live2dCubismCoreUrl: string
  /** User-visible scale multiplier for the avatar stage. */
  live2dScale: number
  /** Whether the overlay can be dragged in the GUI. */
  live2dDraggable: boolean
  /** Whether the avatar should lightly follow the pointer. */
  live2dFollowPointer: boolean
  /** Whether the avatar starts muted. */
  live2dMuted: boolean
  /** Whether motion-linked sound files are allowed to play. */
  live2dAllowMotionSound: boolean
  /** Whether the overlay starts as a compact launcher. */
  live2dDefaultHidden: boolean
}

/** 插件配置 schema，供 Cordis loader 做校验与默认值注入。 */
export const Config = Schema.object({
  live2dEnabled: Schema.boolean().default(false).description(
    '是否启用爱丽丝 Live2D 头像层。',
  ),
  live2dModelBase: Schema.string().default('').description(
    'Live2D 模型配置文件路径（例如 model3.json 的 URL 或本地可访问路径）。',
  ),
  live2dAnchor: Schema.union(['bottom-right', 'bottom-left']).default('bottom-right').description(
    '爱丽丝初始停靠角。',
  ),
  live2dCubismCoreUrl: Schema.string().default('https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js').description(
    'Cubism 3/4 Web 模型所需的 live2dcubismcore.min.js 脚本地址。',
  ),
  live2dScale: Schema.number().default(1).description(
    '爱丽丝模型初始缩放倍率。',
  ),
  live2dDraggable: Schema.boolean().default(true).description(
    '是否允许拖动爱丽丝位置。',
  ),
  live2dFollowPointer: Schema.boolean().default(false).description(
    '是否让爱丽丝轻微跟随指针。',
  ),
  live2dMuted: Schema.boolean().default(false).description(
    '是否默认静音爱丽丝模型音频。',
  ),
  live2dAllowMotionSound: Schema.boolean().default(true).description(
    '是否允许播放 motion 里自带的音频资源。',
  ),
  live2dDefaultHidden: Schema.boolean().default(false).description(
    '是否默认以折叠 launcher 形态显示爱丽丝。',
  ),
})

function currentSettingsFromConfig(config: Readonly<Config>): ArisLive2DSettingsSection {
  return {
    muted: config.live2dMuted,
    allowMotionSound: config.live2dAllowMotionSound,
    defaultHidden: config.live2dDefaultHidden,
  }
}

/** Register the Aris host contribution. */
export function apply(ctx: Context, config: Config): void {
  let currentSettings: () => ArisLive2DSettingsSection = () => currentSettingsFromConfig(config)

  const currentConfig = (): Config => ({
    ...config,
    live2dMuted: currentSettings().muted,
    live2dAllowMotionSound: currentSettings().allowMotionSound,
    live2dDefaultHidden: currentSettings().defaultHidden,
  })

  installSettingsSection(ctx, ARIS_LIVE2D_SETTINGS_NS, ArisLive2DSettingsSchema, currentSettingsFromConfig(config), {
    setSource(source) {
      currentSettings = source
    },
    onChange() {
      // Current sessions read these client-facing values via the settings scope.
      // Host-side getters see the latest source on next access.
    },
  })

  registerArisAvatarProjection(ctx, currentConfig)
  registerArisAvatarTool(ctx, currentConfig)
}
