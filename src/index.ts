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
 * character beside the conversation. Today it is deliberately minimal: it
 * registers a no-op host contribution so the package is installable and the
 * preset's `@aimercat/dsh-aris` row resolves, and it exports the persona
 * metadata for future consumers. The live2d surface will mount here when it
 * exists; the persona itself stays in the preset so it can evolve
 * independently of this host code.
 *
 * @module @aimercat/dsh-aris
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

/** Cordis plugin name. */
export const name = 'aris'

/** The persona identity this package owns. */
export const PERSONA_ID = 'aris'
export const PERSONA_NAME = '天童爱丽丝'

/** Model-facing plugin configuration (currently a marker; live2d config lands here later). */
export interface Config {
  /**
   * Whether the live2d avatar layer is enabled. Reserved for the future
   * live2d mount; today it only gates a no-op so preset composition is stable
   * across versions.
   */
  live2dEnabled: boolean
}

/** 插件配置 schema，供 Cordis loader 做校验与默认值注入。 */
export const Config = Schema.object({
  live2dEnabled: Schema.boolean().default(false).description(
    '是否启用预留的 live2d 头像层；当前仅作为稳定的占位配置项。',
  ),
})

/**
 * Register the Aris host contribution. Currently a no-op reserved for the
 * future live2d layer; the persona itself is carried by the preset's
 * `dsh-persona` row, so no prompt-registry interaction happens here.
 * @param ctx - the mounting context.
 * @param config - plugin configuration.
 */
export function apply(_ctx: Context, _config: Config): void {
  // Reserved: the live2d avatar layer mounts here when implemented.
}
