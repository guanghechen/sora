import { tsMonorepoConfig } from '@guanghechen/jest-config'
import { createRequire } from 'node:module'
import path from 'node:path'
import url from 'node:url'

const require = createRequire(import.meta.url)

export default async function () {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
  const packageDir = path.relative(__dirname, path.resolve()) + '/'
  const baseConfig = await tsMonorepoConfig(__dirname, {
    useESM: true,
    tsconfigFilepath: path.join(__dirname, 'tsconfig.test.esm.json'),
  })

  const config = {
    ...baseConfig,
    collectCoverageFrom: [...(baseConfig.collectCoverageFrom ?? [])],
    coveragePathIgnorePatterns: [],
    coverageThreshold: {
      global: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    coverageThreshold: Object.fromEntries(
      [
        ['global', { branches: 100, functions: 100, lines: 100, statements: 100 }],
        ['packages/pipeline/src/pipeline.ts', { functions: 90 }],
      ]
        .filter(([p]) => !p.startsWith('packages/') || p.startsWith(packageDir))
        .map(([p, val]) => (p.startsWith(packageDir) ? [path.join(__dirname, p), val] : [p, val])),
    ),
    extensionsToTreatAsEsm: ['.ts', '.mts'],
    prettierPath: require.resolve('prettier-2'),
  }
  return config
}
