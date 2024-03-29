import {
  DependencyCategory,
  createRollupConfig,
  dtsPresetConfigBuilder,
  modify,
  tsPresetConfigBuilder,
} from '@guanghechen/rollup-config'
import replace from '@rollup/plugin-replace'
import path from 'node:path'

const builtins = new Set(['@guanghechen/internal'])
const externals = new Set(['./index.mjs'])

const uselessImports = ['node:fs', 'node:fs/promises', 'node:path'].join('|')
const uselessImportRegex = new RegExp(
  `\n(?:import '(?:${uselessImports})'|require\\('(?:${uselessImports})'\\));`,
  'g',
)

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
          tsconfig: 'tsconfig.lib.json',
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
          {
            ...modify({
              modify: (_filename, code) => {
                return code
                  .replace(uselessImportRegex, '')
                  .replace(
                    `import satisfies from 'semver/functions/satisfies';`,
                    `import satisfies from 'semver/functions/satisfies.js';`,
                  )
              },
            }),
            name: '@guanghechen/rollup-plugin-modify/customized',
          },
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
