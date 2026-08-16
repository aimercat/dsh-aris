import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { z } from 'zod'
import {
  ARIS_AVATAR_EVENT,
  ARIS_AVATAR_PROJECTION_KEY,
  ARIS_AVATAR_VERSION,
  type ArisAvatarIntent,
  type ArisAvatarPriority,
  type ArisAvatarProjection,
  type ArisAvatarProjectionValue,
  type ArisAvatarToolResult,
} from './types.ts'
import type { Config } from '../index.ts'

const bubbleTone = ['normal', 'happy', 'warning', 'thinking', 'victory'] as const
const motionPriority = ['idle', 'normal', 'force'] as const
const intentType = ['motion', 'expression', 'bubble'] as const

const avatarProjectionSchema: z.ZodType<ArisAvatarProjection> = z.object({
  version: z.literal(ARIS_AVATAR_VERSION),
  intentId: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
  reason: z.string().min(1).optional(),
  dedupeKey: z.string().min(1).optional(),
  intent: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('motion'),
      group: z.string().min(1),
      index: z.number().int().nonnegative().optional(),
      priority: z.enum(motionPriority).optional(),
      loop: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('expression'),
      expression: z.string().min(1),
      durationMs: z.number().int().positive().max(30000).optional(),
    }),
    z.object({
      type: z.literal('bubble'),
      text: z.string().min(1).max(80),
      tone: z.enum(bubbleTone).optional(),
      durationMs: z.number().int().positive().max(30000).optional(),
    }),
  ]),
})

function renderToolResult(value: ArisAvatarToolResult): string {
  const status = value.degraded ? 'noop' : value.appliedMode
  if (value.projection === undefined) return `Aris avatar control accepted (${status}).`
  const intent = value.projection.intent
  if (intent.type === 'motion') return `Aris avatar control accepted: motion ${intent.group}${intent.index === undefined ? '' : `#${intent.index}`} (${status}).`
  if (intent.type === 'expression') return `Aris avatar control accepted: expression ${intent.expression} (${status}).`
  return `Aris avatar control accepted: bubble \"${intent.text}\" (${status}).`
}

function toPriority(value: string | undefined): ArisAvatarPriority | undefined {
  return value === undefined ? undefined : motionPriority.find(entry => entry === value)
}

function buildIntent(args: {
  type: string
  group?: string
  index?: number
  priority?: string
  loop?: boolean
  expression?: string
  text?: string
  tone?: string
  durationMs?: number
}): ArisAvatarIntent {
  switch (args.type) {
    case 'motion': {
      if (args.group === undefined || args.group.trim() === '') throw new Error('aris_avatar_control: motion requires a non-empty group')
      return {
        type: 'motion',
        group: args.group,
        ...args.index === undefined ? {} : { index: args.index },
        ...args.priority === undefined ? {} : { priority: toPriority(args.priority) },
        ...args.loop === undefined ? {} : { loop: args.loop },
      }
    }
    case 'expression': {
      if (args.expression === undefined || args.expression.trim() === '') throw new Error('aris_avatar_control: expression requires a non-empty expression id')
      return {
        type: 'expression',
        expression: args.expression,
        ...args.durationMs === undefined ? {} : { durationMs: args.durationMs },
      }
    }
    case 'bubble': {
      if (args.text === undefined || args.text.trim() === '') throw new Error('aris_avatar_control: bubble requires non-empty text')
      return {
        type: 'bubble',
        text: args.text,
        ...args.tone === undefined ? {} : { tone: args.tone as (typeof bubbleTone)[number] },
        ...args.durationMs === undefined ? {} : { durationMs: args.durationMs },
      }
    }
    default:
      throw new Error(`aris_avatar_control: unsupported type ${args.type}`)
  }
}

function newIntentId(): string {
  return `aris-avatar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function registerArisAvatarProjection(ctx: Context): void {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    const definition: ProjectionDefinition<typeof ARIS_AVATAR_PROJECTION_KEY, ArisAvatarProjectionValue> = {
      key: ARIS_AVATAR_PROJECTION_KEY,
      schema: avatarProjectionSchema.nullable(),
      init: (): ArisAvatarProjectionValue => null,
      apply: (state: ArisAvatarProjectionValue, event: SessionEvent): ArisAvatarProjectionValue => {
        if (event.type !== ARIS_AVATAR_EVENT) return state
        return avatarProjectionSchema.parse(event.data.projection)
      },
      view: (state: ArisAvatarProjectionValue): ArisAvatarProjectionValue => state,
      stateVersion: 1,
    }
    projectionCtx.sessionProjections.register(definition)
  })
}

export function registerArisAvatarTool(ctx: Context, config: Readonly<Config>): void {
  ctx.tools.register(defineTool({
    name: 'aris_avatar_control',
    description: 'Control the Aris live avatar with a declarative motion, expression, or bubble intent.',
    parameters: {
      type: {
        type: 'string',
        required: true,
        enum: [...intentType],
        description: 'Intent kind: motion | expression | bubble.',
      },
      group: {
        type: 'string',
        description: 'Motion group name when type is motion.',
      },
      index: {
        type: 'integer',
        description: 'Optional motion index inside the motion group.',
      },
      priority: {
        type: 'string',
        enum: [...motionPriority],
        description: 'Motion priority: idle | normal | force.',
      },
      loop: {
        type: 'boolean',
        description: 'Whether the motion should loop when supported by the runtime.',
      },
      expression: {
        type: 'string',
        description: 'Expression id when type is expression.',
      },
      text: {
        type: 'string',
        description: 'Bubble text when type is bubble.',
      },
      tone: {
        type: 'string',
        enum: [...bubbleTone],
        description: 'Bubble tone when type is bubble.',
      },
      durationMs: {
        type: 'integer',
        description: 'Optional effect duration in milliseconds.',
      },
      reason: {
        type: 'string',
        description: 'Short human-readable reason for audit logs.',
      },
      dedupeKey: {
        type: 'string',
        description: 'Optional dedupe key for repeated intents.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          accepted: { type: 'boolean', required: true },
          intentId: { type: 'string', required: true },
          appliedMode: { type: 'string', required: true, enum: ['live2d', 'noop'] },
          degraded: { type: 'boolean', required: true },
          message: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderToolResult(value as ArisAvatarToolResult) }],
    },
    async execute(args, exec) {
      const intent = buildIntent(args)
      const intentId = newIntentId()
      const enabled = config.live2dEnabled && config.live2dModelBase.trim() !== ''
      if (!enabled) {
        const result: ArisAvatarToolResult = {
          accepted: true,
          intentId,
          appliedMode: 'noop',
          degraded: true,
          message: 'live2d layer inactive',
        }
        return result
      }
      if (!exec.agent) throw new Error('aris_avatar_control requires an owning agent session')
      const projection: ArisAvatarProjection = avatarProjectionSchema.parse({
        version: ARIS_AVATAR_VERSION,
        intentId,
        updatedAt: Date.now(),
        ...args.reason === undefined ? {} : { reason: args.reason },
        ...args.dedupeKey === undefined ? {} : { dedupeKey: args.dedupeKey },
        intent,
      })
      exec.agent.session.append(ARIS_AVATAR_EVENT, { projection })
      const result: ArisAvatarToolResult = {
        accepted: true,
        intentId,
        appliedMode: 'live2d',
        degraded: false,
        projection,
        message: 'live2d intent dispatched',
      }
      return result
    },
    presentCall: (args) => ({
      card: 'generic',
      title: 'Control Aris avatar',
      kind: 'other',
      rawInput: args,
    }),
  }))
}
