import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const coverageMap: Record<
  string,
  Record<string, { branches?: number; functions?: number; lines?: number; statements?: number }>
> = {
  '@guanghechen/commander': {
    global: { branches: 95, functions: 91, lines: 98, statements: 98 },
    'src/index.ts': { branches: 0, functions: 0, lines: 0, statements: 0 },
  },
  '@guanghechen/config': {
    global: { functions: 94, statements: 98 },
  },
  '@guanghechen/disposable': {
    global: { branches: 95 },
  },
  '@guanghechen/equal': {
    global: { branches: 95, statements: 97 },
  },
  '@guanghechen/invariant': {
    global: { branches: 87 },
  },
  '@guanghechen/observable': {
    global: { branches: 96, functions: 94, lines: 98, statements: 98 },
  },
  '@guanghechen/path': {
    global: { branches: 95, statements: 98 },
    'src/PathResolver.ts': { branches: 90, statements: 98 },
    'src/UrlPathResolver.ts': { branches: 96, statements: 98 },
  },
  '@guanghechen/reporter': {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  '@guanghechen/scheduler': {
    global: { branches: 81, functions: 100, lines: 97, statements: 94 },
  },
  '@guanghechen/std': {
    global: { branches: 88, functions: 94, lines: 94, statements: 94 },
    'src/root.ts': { branches: 0 },
    'src/string/vender/change-case.ts': { branches: 53, functions: 80, lines: 84, statements: 81 },
    'src/string/vender/title-case.ts': { branches: 50, lines: 83, statements: 83 },
  },
  '@guanghechen/subscriber': {
    global: { branches: 94, functions: 93, statements: 98 },
  },
  '@guanghechen/task': {
    global: { branches: 91, statements: 99 },
  },
  '@guanghechen/version': {
    global: { branches: 93, functions: 94, statements: 96 },
  },
  '@guanghechen/viewmodel': {
    global: { branches: 93, functions: 98, lines: 98, statements: 97 },
  },
}

function loadPackageName(): string {
  const manifestPath = path.resolve('package.json')
  if (!fs.existsSync(manifestPath)) return ''
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  return manifest.name ?? ''
}

function getPackageDirName(): string {
  const cwd = process.cwd()
  const match = cwd.match(/packages[/\\]([^/\\]+)$/)
  return match ? match[1] : ''
}

// Get all package directory names to exclude from coverage (except current package)
function getOtherPackageExcludes(): string[] {
  const packagesDir = path.resolve(__dirname, 'packages')
  const currentPackage = getPackageDirName()
  if (!fs.existsSync(packagesDir)) return []

  const packages = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== currentPackage)
    .map(dirent => `${path.resolve(packagesDir, dirent.name, 'src')}/**`)

  return packages
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__test__/**/*.spec.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/__test__/**', ...getOtherPackageExcludes()],
      thresholds: (() => {
        const packageName = loadPackageName()
        const packageCoverage = coverageMap[packageName]
        return {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
          ...packageCoverage?.global,
          ...Object.fromEntries(
            Object.entries(packageCoverage ?? {})
              .filter(([key]) => key !== 'global')
              .map(([filePath, thresholds]) => [filePath, thresholds]),
          ),
        }
      })(),
    },
  },
  resolve: {
    alias: {
      'vitest.helper': path.resolve(__dirname, 'vitest.helper.mts'),
      '@guanghechen/byte': path.resolve(__dirname, 'packages/byte/src'),
      '@guanghechen/config': path.resolve(__dirname, 'packages/config/src'),
      '@guanghechen/disposable': path.resolve(__dirname, 'packages/disposable/src'),
      '@guanghechen/disposable.types': path.resolve(__dirname, 'packages/disposable.types/src'),
      '@guanghechen/env': path.resolve(__dirname, 'packages/env/src'),
      '@guanghechen/equal': path.resolve(__dirname, 'packages/equal/src'),
      '@guanghechen/error.types': path.resolve(__dirname, 'packages/error.types/src'),
      '@guanghechen/event-bus': path.resolve(__dirname, 'packages/event-bus/src'),
      '@guanghechen/file-split': path.resolve(__dirname, 'packages/file-split/src'),
      '@guanghechen/filepart': path.resolve(__dirname, 'packages/filepart/src'),
      '@guanghechen/invariant': path.resolve(__dirname, 'packages/invariant/src'),
      '@guanghechen/middleware': path.resolve(__dirname, 'packages/middleware/src'),
      '@guanghechen/monitor': path.resolve(__dirname, 'packages/monitor/src'),
      '@guanghechen/observable': path.resolve(__dirname, 'packages/observable/src'),
      '@guanghechen/path': path.resolve(__dirname, 'packages/path/src'),
      '@guanghechen/path.types': path.resolve(__dirname, 'packages/path.types/src'),
      '@guanghechen/reporter': path.resolve(__dirname, 'packages/reporter/src'),
      '@guanghechen/resource': path.resolve(__dirname, 'packages/resource/src'),
      '@guanghechen/scheduler': path.resolve(__dirname, 'packages/scheduler/src'),
      '@guanghechen/std': path.resolve(__dirname, 'packages/std/src'),
      '@guanghechen/stream': path.resolve(__dirname, 'packages/stream/src'),
      '@guanghechen/subscriber': path.resolve(__dirname, 'packages/subscriber/src'),
      '@guanghechen/task': path.resolve(__dirname, 'packages/task/src'),
      '@guanghechen/version': path.resolve(__dirname, 'packages/version/src'),
      '@guanghechen/viewmodel': path.resolve(__dirname, 'packages/viewmodel/src'),
    },
  },
})
