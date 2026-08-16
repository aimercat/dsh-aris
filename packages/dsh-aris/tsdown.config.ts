import { defineConfig } from 'tsdown'

/**
 * @aimercat/dsh-aris build: the node half (host plugin + invariant) and the
 * browser half (client bundle served at /plugins/@aimercat/dsh-aris/client.js).
 *
 * The client bundle follows the harness client-plugin contract: a CJS factory
 * handed to window.__ModuleLoader__.load, with every @deepseek-ai import being
 * type-only (erased at compile time), so the only external is cordis itself
 * (resolved from the loader module table).
 */
export default defineConfig([
  {
    name: '@aimercat/dsh-aris',
    entry: ['src/index.ts', 'src/invariant.ts', 'src/brave-permission.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    external: ['@deepseek-ai/cordis', /^@deepseek-ai\/dsh-/],
  },
  {
    name: '@aimercat/dsh-aris/client',
    entry: { client: 'src/client/index.ts' },
    // Browser bundle lands as exactly lib/client.js next to the node half.
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      alwaysBundle: ['pixi.js', '@jannchie/pixi-live2d-display', '@jannchie/pixi-live2d-display/cubism4'],
      neverBundle: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-client-locale',
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-ui-settings',
        '@deepseek-ai/dsh-client-ui-slots',
        'react',
        'react/jsx-runtime',
      ],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      inlineDynamicImports: true,
      banner: 'window.__ModuleLoader__.load({ id: "@aimercat/dsh-aris", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
