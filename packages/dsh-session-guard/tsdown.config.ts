import { defineConfig } from 'tsdown'

/**
 * @aimercat/dsh-session-guard build: host half only (no client bundle in
 * v0.1 — the guard is a pure node-plane service). Every @deepseek-ai/dsh-*
 * import is external and resolved from the host runtime at load time; the
 * only bundled dependency is schemastery (not matched by the dsh-* external
 * pattern), mirroring the dsh-aris host-half layout.
 */
export default defineConfig([
  {
    name: '@aimercat/dsh-session-guard',
    entry: ['src/index.ts', 'src/invariant.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    external: ['@deepseek-ai/cordis', /^@deepseek-ai\/dsh-/],
  },
])
