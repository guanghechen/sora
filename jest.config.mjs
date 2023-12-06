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
      global: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
      ...coverageMap[manifest.name],
    },
    extensionsToTreatAsEsm: ['.ts', '.mts'],
    prettierPath: require.resolve('prettier-2'),
  }
  return config
}

const coverageMap = {
  '@guanghechen/internal': {
    'src/util/fs.ts': { branches: 91, lines: 96, statements: 96 },
    'src/util/noop.ts': { functions: 0 },
  },
  //-----------//

  '@guanghechen/cipher-catalog': {
    global: {
      branches: 96,
      functions: 63,
      lines: 45,
      statements: 45,
    }
  },
  '@guanghechen/filetree': {
    global: {
      branches: 83,
      functions: 90,
      lines: 93,
      statements: 93,
    },
  },
  '@guanghechen/path': {
    'src/PathResolver.ts': { branches: 90 },
    'src/UrlPathResolver.ts': { branches: 97 },
  },
  '@guanghechen/reporter': {
    global: {
      branches: 96,
      functions: 43,
      lines: 78,
      statements: 78,
    }
  },
  '@guanghechen/vfs': {
    global: {
      branches: 80,
      functions: 65,
      lines: 82,
      statements: 82,
    },
  },
  '@guanghechen/viewmodel': {
    global: {
      branches: 87,
      functions: 63,
      lines: 56,
      statements: 56,
    },
  },
}
