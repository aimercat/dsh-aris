/**
 * Sub-path plugin entry: `@aimercat/dsh-aris/brave-permission`.
 *
 * Exposes the「勇者权限」host policy as its own Cordis plugin id so the bundle
 * patch can mount it beside the `aris` host plugin from the same package.
 */

export {
  BRAVE_PERMISSION_PRESET,
  Config,
  apply,
  braveAuthority,
  inject,
  isBravePermissionExecution,
  name,
} from './brave/index.js'

export { ArtifactRegistry } from './brave/artifacts.js'
export * from './brave/paths.js'
export * from './brave/policy.js'
export * from './brave/shell.js'
export type * from './brave/types.js'
