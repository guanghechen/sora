import { tsMonorepoConfig } from '@guanghechen/jest-config'
import { createRequire } from 'node:module'
import path from 'node:path'
import url from 'node:url'

const require = createRequire(import.meta.url)

export default async function () {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
  const { default: manifest } = await import(path.resolve('package.json'), {
    assert: { type: 'json' },
  })
  const baseConfig = await tsMonorepoConfig(__dirname, {
    useESM: true,
    tsconfigFilepath: path.join(__dirname, 'tsconfig.test.esm.json'),
  })

  const config = {
    ...baseConfig,
    collectCoverageFrom: [...(baseConfig.collectCoverageFrom ?? [])],
    coveragePathIgnorePatterns: [],
    coverageThreshold: {
      ...(coverageMap[manifest.name] ?? {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      }),
    },
    extensionsToTreatAsEsm: ['.ts', '.mts'],
    prettierPath: require.resolve('prettier-2'),
  }
  return config
}

const coverageMap = {
  '@guanghechen/viewmodel': {
    global: {
      branches: 85,
      functions: 70,
      lines: 66,
      statements: 66,
    },
  },
}
