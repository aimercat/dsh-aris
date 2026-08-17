import { defineConfig } from 'tsdown'

/**
 * @aimercat/dsh-aris-settings build: the node half (settings bridge routes)
 * and the browser half (client bundle served at
 * /plugins/@aimercat/dsh-aris-settings/client.js).
 *
 * The client bundle follows the harness client-plugin contract: a CJS
 * factory handed to window.__ModuleLoader__.load, with every @deepseek-ai
 * import being type-only (erased at compile time), so the only external is
 * cordis itself (resolved from the loader module table).
 */
export default defineConfig([
  {
    name: '@aimercat/dsh-aris-settings',
    entry: ['src/index.ts'],
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
    name: '@aimercat/dsh-aris-settings/client',
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
      neverBundle: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-client-locale',
        '@deepseek-ai/dsh-client-runtime',
        // Sub-path specifier: the store engine (createSnapshotStore) rides
        // the loader module table at this exact specifier (the documented
        // runtime-store exemption) — the package-level entry above does not
        // match it, and bundling the UMD client.js fails export analysis.
        '@deepseek-ai/dsh-client-runtime/client',
        '@deepseek-ai/dsh-client-connection/client',
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
      banner: 'window.__ModuleLoader__.load({ id: "@aimercat/dsh-aris-settings", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
