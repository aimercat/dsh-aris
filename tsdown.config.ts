import { defineConfig } from 'tsdown'

export default defineConfig({
  name: '@aimercat/dsh-aris',
  entry: ['src/index.ts', 'src/invariant.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  external: ['@deepseek-ai/cordis', /^@deepseek-ai\/dsh-/],
})
