import {
  DependencyCategory,
  createRollupConfig,
  modify,
  tsPresetConfigBuilder,
} from '@guanghechen/rollup-config'
import replace from '@rollup/plugin-replace'
import path from 'node:path'

const builtins = new Set(['@guanghechen/shared'])
const externals = new Set(['./index.mjs'])

export default async function rollupConfig() {
  const { default: manifest } = await import(path.resolve('package.json'), {
    assert: { type: 'json' },
  })
  const config = await createRollupConfig({
    manifest,
    env: {
      sourcemap: false,
    },
    presetConfigBuilders: [
      tsPresetConfigBuilder({
        typescriptOptions: {
          tsconfig: 'tsconfig.src.json',
        },
        additionalPlugins: [
          replace({
            include: ['src/node.ts', 'src/browser.ts'],
            delimiters: ['', ''],
            preventAssignment: true,
            values: {
              [`} from '.';`]: `} from './index.mjs';`,
            },
          }),
          modify(),
        ],
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
