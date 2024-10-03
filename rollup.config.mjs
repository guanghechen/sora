import {
  DependencyCategory,
  createRollupConfig,
  dtsPresetConfigBuilder,
  modify,
  tsPresetConfigBuilder,
} from '@guanghechen/rollup-config'
import replace from '@rollup/plugin-replace'
import path from 'node:path'

const builtins = new Set([])
const externals = new Set(['./index.mjs'])

export default async function rollupConfig() {
  const { default: manifest } = await import(path.resolve('package.json'), {
    assert: { type: 'json' },
  })
  const config = await createRollupConfig({
    manifest,
    presetConfigBuilders: [
      tsPresetConfigBuilder({
        typescriptOptions: {
          tsconfig: 'tsconfig.lib.json',
        },
        additionalPlugins: [
          replace({
            include: ['src/node.ts', 'src/browser.ts'],
            delimiters: ['', ''],
            preventAssignment: true,
            values: {
              "} from '.';": "} from './index.mjs';",
            },
          }),
          modify(),
        ],
      }),
      dtsPresetConfigBuilder({
        dtsOptions: {
          respectExternal: true,
          tsconfig: 'tsconfig.lib.json',
        },
      }),
    ],
    classifyDependency: id => {
      if (builtins.has(id)) return DependencyCategory.BUILTIN
      if (externals.has(id)) return DependencyCategory.EXTERNAL
      return DependencyCategory.UNKNOWN
    },
  })
  return config
}
