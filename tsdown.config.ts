import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { type UserConfig, defineConfig } from 'tsdown'

// Run per-package: `tsdown --config ../../tsdown.config.ts` (cwd = the package dir).
// rolldown anchors relative entry/outDir/copy to the config file's dir (repo root),
// so those must be absolute (based on cwd); manifest/tsconfig resolve against cwd.
const manifest = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'))

const shouldSourcemap = process.env.SOURCEMAP === 'true'
const tsconfig = 'tsconfig.lib.json'

// Derive build entries from the package `exports`: output basename -> source (absolute).
// Single entry uses `.`; multi-entry iterates subpaths, skipping `null`.
function resolveEntries(pkg: Record<string, any>): Record<string, string> {
  const entries: Record<string, string> = {}
  const add = (entry: unknown): void => {
    if (!entry || typeof entry !== 'object') return
    const e = entry as Record<string, string>
    const src = e.source
    const outRef = e.import ?? e.require ?? e.types
    if (!src || !outRef) return
    const name = outRef
      .split('/')
      .pop()!
      .replace(/\.d\.ts$/, '')
      .replace(/\.[mc]?js$/, '')
    entries[name] = path.resolve(src)
  }

  const field = pkg.exports
  if (field && typeof field === 'object') {
    const isConditionMap = ['source', 'import', 'require', 'types'].some(k => k in field)
    if (isConditionMap) add(field)
    else for (const entry of Object.values(field)) add(entry)
  }

  if (Object.keys(entries).length === 0) {
    entries.index = path.resolve(pkg.source ?? './src/index.ts')
  }
  return entries
}

// commander ships its schema assets alongside the bundle.
const copy =
  manifest.name === '@guanghechen/commander'
    ? [{ from: path.resolve('schema/*.schema.json'), to: path.resolve('lib/schema') }]
    : undefined

// Externalize declared deps (incl. subpaths). tsdown's auto-external reads the root
// package.json (config dir), so compute it from the package manifest; node builtins
// are externalized by rolldown automatically.
const externalDeps = [
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
  ...Object.keys(manifest.optionalDependencies ?? {}),
]
const neverBundle = externalDeps.map(
  name => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/|$)`),
)

// One config per entry: single-entry builds are self-contained (no cross-entry shared
// chunk), keeping browser/node isolated. `clean` is off (like the old rollup setup) to
// avoid siblings wiping the shared lib/{esm,cjs} dirs; use `rimraf lib` to clean.
const configs: UserConfig[] = []
let copyAttached = false
for (const [name, input] of Object.entries(resolveEntries(manifest))) {
  const entry = { [name]: input }
  const shared = { entry, clean: false, tsconfig, deps: { neverBundle } } as const

  // ESM -> lib/esm/<name>.mjs
  configs.push({
    ...shared,
    format: 'esm',
    outDir: path.resolve('lib/esm'),
    fixedExtension: true,
    dts: false,
    sourcemap: shouldSourcemap,
    outputOptions: { exports: 'named' },
    copy: copyAttached ? undefined : copy,
  })
  copyAttached = true

  // CJS -> lib/cjs/<name>.cjs
  configs.push({
    ...shared,
    format: 'cjs',
    outDir: path.resolve('lib/cjs'),
    fixedExtension: true,
    dts: false,
    sourcemap: shouldSourcemap,
    outputOptions: { exports: 'named' },
  })

  // Types -> lib/types/<name>.d.ts (bundled dts only, no JS).
  // fixedExtension: false yields .d.ts (not .d.mts); declarationMap off to match old output.
  configs.push({
    ...shared,
    format: 'esm',
    outDir: path.resolve('lib/types'),
    fixedExtension: false,
    dts: { emitDtsOnly: true, tsconfig, compilerOptions: { declarationMap: false } },
    sourcemap: false,
  })
}

export default defineConfig(configs)
