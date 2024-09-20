import { tsMonorepoConfig } from '@guanghechen/jest-config'
import path from 'node:path'
import url from 'node:url'

export default async function () {
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
  const { default: manifest } = await import(path.resolve('package.json'), {
    assert: { type: 'json' },
  })
  const baseConfig = await tsMonorepoConfig(__dirname, {
    useESM: true,
    tsconfigFilepath: path.join(__dirname, 'tsconfig.test.json'),
  })

  const config = {
    ...baseConfig,
    collectCoverageFrom: [...(baseConfig.collectCoverageFrom ?? [])],
    coveragePathIgnorePatterns: [],
    coverageThreshold: {
      ...coverageMap[manifest.name],
      global: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
        ...coverageMap[manifest.name]?.global,
      },
    },
    extensionsToTreatAsEsm: ['.ts', '.mts'],
  }
  return config
}

const coverageMap = {
  '@guanghechen/internal': {
    global: { branches: 0, functions: 0, lines: 0, statements: 0 },
  },
  // -----------//

  '@guanghechen/chalk': {
    global: { branches: 73, functions: 42, lines: 46, statements: 46 },
  },
  '@guanghechen/observable': {
    global: { functions: 94 },
  },
  '@guanghechen/path': {
    'src/PathResolver.ts': { branches: 90 },
    'src/UrlPathResolver.ts': { branches: 97 },
  },
  '@guanghechen/reporter': {
    global: { branches: 96, functions: 43, lines: 78, statements: 78 },
  },
  '@guanghechen/scheduler': {
    global: { branches: 86, functions: 97, lines: 95, statements: 95 },
  },
  '@guanghechen/string': {
    'src/vender/change-case.ts': { branches: 53, functions: 82 },
    'src/vender/title-case.ts': { branches: 50 },
  },
  '@guanghechen/subscriber': {
    global: { functions: 93 },
  },
  '@guanghechen/viewmodel': {
    global: { branches: 58, functions: 46, lines: 58, statements: 58 },
  },
}
