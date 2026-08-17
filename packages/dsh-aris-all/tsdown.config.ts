import { defineConfig } from 'tsdown'

/** @aimercat/dsh-aris-all build: the carrier host half only (no client half). */
export default defineConfig({
  name: '@aimercat/dsh-aris-all',
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  external: ['@deepseek-ai/cordis', /^@deepseek-ai\/dsh-/],
})
