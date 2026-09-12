import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const packagesDir = path.join(root, 'packages')
const args = process.argv.slice(2)
assert.ok(args.every(arg => arg === '--sourcemap' || arg === '--no-sourcemap'))
assert.ok(!(args.includes('--sourcemap') && args.includes('--no-sourcemap')))
const sourcemap = args.includes('--sourcemap')
  ? true
  : args.includes('--no-sourcemap')
    ? false
    : undefined
const consumerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sora-dist-'))
const modules = new Map()
const consumers = []

try {
  const scopeDir = path.join(consumerDir, 'node_modules/@guanghechen')
  fs.mkdirSync(scopeDir, { recursive: true })
  fs.symlinkSync(
    path.join(root, 'node_modules/@types'),
    path.join(consumerDir, 'node_modules/@types'),
    'junction',
  )

  for (const name of fs.readdirSync(packagesDir).sort()) {
    const packageDir = path.join(packagesDir, name)
    const manifestPath = path.join(packageDir, 'package.json')
    if (!fs.existsSync(manifestPath)) continue
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    if (!manifest.scripts?.build) continue

    fs.symlinkSync(packageDir, path.join(scopeDir, name), 'junction')
    const require = createRequire(manifestPath)
    for (const [subpath, entry] of Object.entries(manifest.exports)) {
      const specifier = manifest.name + (subpath === '.' ? '' : subpath.slice(1))
      if (entry === null) {
        assert.throws(() => require.resolve(specifier), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' })
        continue
      }

      for (const condition of ['import', 'require', 'types']) {
        assert.equal(typeof entry[condition], 'string', `${specifier}: missing ${condition}`)
        assert.ok(fs.statSync(path.resolve(packageDir, entry[condition])).isFile())
      }

      const esm = await import(pathToFileURL(path.resolve(packageDir, entry.import)).href)
      const cjs = require(specifier)
      const exportedNames = Object.keys(esm).sort()
      assert.ok(exportedNames.length > 0, `${specifier}: missing ESM exports`)
      assert.deepEqual(
        Object.keys(cjs)
          .filter(key => key !== '__esModule')
          .sort(),
        exportedNames,
        `${specifier}: ESM and CJS exports must agree`,
      )
      modules.set(specifier, [esm, cjs])

      const aliases = exportedNames.map((key, i) => `${key} as entry${modules.size}_${i}`)
      consumers.push(`export { ${aliases.join(', ')} } from ${JSON.stringify(specifier)}`)

      for (const condition of ['import', 'require']) {
        const file = path.resolve(packageDir, entry[condition])
        const code = fs.readFileSync(file, 'utf8')
        const mapPath = `${file}.map`
        if (sourcemap !== undefined) {
          assert.equal(fs.existsSync(mapPath), sourcemap, `${specifier}: ${condition} sourcemap`)
        }
        assert.doesNotMatch(code, /\/\/#(?:end)?region\b/, `${specifier}: source region markers`)
        if (fs.existsSync(mapPath)) {
          const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))
          assert.equal(map.version, 3)
          assert.ok(map.sources.length > 0, `${specifier}: empty sourcemap`)
          assert.ok(code.includes(`sourceMappingURL=${path.basename(mapPath)}`))
        } else {
          assert.doesNotMatch(code, /sourceMappingURL=/, `${specifier}: dangling sourcemap URL`)
        }
      }
      assert.equal(fs.existsSync(path.resolve(packageDir, `${entry.types}.map`)), false)
      console.log(`${specifier}: ESM and CJS exports passed`)
    }

    if (sourcemap === false) {
      const files = fs.readdirSync(path.join(packageDir, 'lib'), { recursive: true })
      assert.ok(
        files.every(file => !file.endsWith('.map')),
        `${manifest.name}: stale sourcemaps`,
      )
    }
    if (name === 'commander') {
      for (const file of fs.readdirSync(path.join(packageDir, 'schema'))) {
        if (!file.endsWith('.schema.json')) continue
        assert.deepEqual(
          fs.readFileSync(path.join(packageDir, 'lib/schema', file)),
          fs.readFileSync(path.join(packageDir, 'schema', file)),
          `${manifest.name}: schema asset ${file}`,
        )
      }
    }
  }

  assert.ok(modules.size > 0, 'No built packages found')
  for (const mod of modules.get('@guanghechen/equal')) {
    assert.equal(mod.default, mod.isEqual)
    assert.equal(mod.isEqual({ nested: [1, 2] }, { nested: [1, 2] }), true)
  }
  for (const [format, mod] of modules.get('@guanghechen/observable').entries()) {
    const value = new mod.Observable(1)
    assert.ok(value instanceof modules.get('@guanghechen/disposable')[format].BatchDisposable)
    value.next(2)
    assert.equal(value.getSnapshot(), 2)
    value.dispose()
  }
  // Loading both entries must not let the Node adapter replace the browser adapter.
  for (const mod of modules.get('@guanghechen/commander/browser')) {
    assert.equal(mod.CompletionCommand, undefined)
    await assert.rejects(
      mod.getDefaultCommandRuntime().readFile(path.join(root, 'package.json')),
      /does not support file-system operation/,
    )
  }
  for (const mod of modules.get('@guanghechen/commander/node')) {
    assert.equal(typeof mod.CompletionCommand, 'function')
    const text = await mod.getDefaultCommandRuntime().readFile(path.join(root, 'package.json'))
    assert.equal(JSON.parse(text).name, 'root')
  }

  consumers.push(
    '// @ts-expect-error Internal constructor options must not become public exports.',
    "export type { IOptions as PrivateSubscriberOptions } from '@guanghechen/subscriber'",
  )
  const consumerPaths = ['consumer.mts', 'consumer.cts'].map(file => path.join(consumerDir, file))
  for (const file of consumerPaths) fs.writeFileSync(file, `${consumers.join('\n')}\n`)
  const result = spawnSync(
    'tsc',
    [
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--target',
      'esnext',
      '--module',
      'nodenext',
      '--types',
      'node',
      ...consumerPaths,
    ],
    { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' },
  )
  assert.ifError(result.error)
  assert.equal(
    result.status,
    0,
    `Public declaration consumers failed:\n${result.stdout}${result.stderr}`,
  )
  console.log(`${modules.size} entries: public declarations and runtime smoke checks passed`)
} finally {
  fs.rmSync(consumerDir, { recursive: true, force: true })
}
