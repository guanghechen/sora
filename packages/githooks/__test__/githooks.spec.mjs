import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  HOOKS_DIR,
  installHooks,
  isCI,
  isValidHookName,
  listHooks,
  renderHookScript,
  resolveHooksConfig,
  uninstallHooks,
} from '../index.mjs'

const silent = { info() {} }
const notCI = {}

/** @type {string[]} */
const created = []

function tmpdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'githooks-'))
  created.push(dir)
  return dir
}

function writeManifest(dir, hooks) {
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(hooks === undefined ? {} : { githooks: { hooks } }),
  )
}

function gitRepo(hooks) {
  const dir = tmpdir()
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir })
  writeManifest(dir, hooks)
  return dir
}

function hooksPathOf(cwd) {
  try {
    return execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd,
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

afterEach(() => {
  while (created.length > 0) fs.rmSync(created.pop(), { recursive: true, force: true })
})

describe('renderHookScript', () => {
  it('emits a POSIX sh hook honoring the GITHOOKS=0 bypass', () => {
    const script = renderHookScript('pnpm exec lint-staged')
    expect(script.startsWith('#!/usr/bin/env sh\n')).toBe(true)
    expect(script).toContain('[ "${GITHOOKS-}" = "0" ] && exit 0')
    expect(script.trimEnd().endsWith('pnpm exec lint-staged')).toBe(true)
  })
})

describe('isCI', () => {
  it('detects CI via common env vars and ignores falsy values', () => {
    expect(isCI({ CI: 'true' })).toBe(true)
    expect(isCI({ CONTINUOUS_INTEGRATION: '1' })).toBe(true)
    expect(isCI({ GITHUB_ACTIONS: 'true' })).toBe(true)
    expect(isCI({ BUILD_NUMBER: '42' })).toBe(true)
    expect(isCI({})).toBe(false)
    expect(isCI({ CI: 'false' })).toBe(false)
    expect(isCI({ CI: '0' })).toBe(false)
  })

  it('defaults to process.env', () => {
    expect(typeof isCI()).toBe('boolean')
  })
})

describe('isValidHookName', () => {
  it('accepts bare names and rejects empty / traversal / separators', () => {
    expect(isValidHookName('pre-commit')).toBe(true)
    expect(isValidHookName('')).toBe(false)
    expect(isValidHookName('.')).toBe(false)
    expect(isValidHookName('..')).toBe(false)
    expect(isValidHookName('a/b')).toBe(false)
    expect(isValidHookName('a\\b')).toBe(false)
    // NUL, escaped so this source file stays text-reviewable (rg / git diff).
    expect(isValidHookName('a' + String.fromCharCode(0) + 'b')).toBe(false)
  })
})

describe('resolveHooksConfig', () => {
  it('drops non-string, blank, and unsafe-named entries', () => {
    const dir = gitRepo({
      'pre-commit': 'pnpm exec lint-staged',
      'pre-push': '   ',
      'commit-msg': 123,
      '../owned': 'echo pwn',
    })
    expect(resolveHooksConfig(dir)).toEqual({ 'pre-commit': 'pnpm exec lint-staged' })
  })

  it('returns an empty map when no githooks config is present', () => {
    expect(resolveHooksConfig(gitRepo(undefined))).toEqual({})
  })

  it('defaults cwd to the current package (which has no githooks field)', () => {
    expect(resolveHooksConfig()).toEqual({})
  })
})

describe('installHooks', () => {
  it('generates hooks and points core.hooksPath at them', () => {
    const dir = gitRepo({ 'pre-commit': 'echo hi' })
    expect(installHooks({ cwd: dir, env: notCI, logger: silent })).toBe(true)

    const file = path.join(dir, HOOKS_DIR, 'pre-commit')
    expect(fs.readFileSync(file, 'utf8')).toContain('echo hi')
    expect((fs.statSync(file).mode & 0o111) !== 0).toBe(true)
    expect(hooksPathOf(dir)).toBe(HOOKS_DIR)
  })

  it('anchors hooks at the git root even when invoked from a subdirectory (F-001)', () => {
    const root = gitRepo({ 'pre-commit': 'echo hi' })
    const sub = path.join(root, 'packages', 'x')
    fs.mkdirSync(sub, { recursive: true })
    expect(installHooks({ cwd: sub, env: notCI, logger: silent })).toBe(true)
    expect(fs.existsSync(path.join(root, HOOKS_DIR, 'pre-commit'))).toBe(true)
    expect(fs.existsSync(path.join(sub, HOOKS_DIR))).toBe(false)
    expect(hooksPathOf(root)).toBe(HOOKS_DIR)
  })

  it('the installed hook actually runs on a real git commit (F-001)', () => {
    const root = gitRepo({ 'pre-commit': 'touch .hook-ran' })
    expect(installHooks({ cwd: root, env: notCI, logger: silent })).toBe(true)
    execFileSync('git', ['commit', '--allow-empty', '-m', 'x'], { cwd: root, stdio: 'ignore' })
    expect(fs.existsSync(path.join(root, '.hook-ran'))).toBe(true)
  })

  it('does not write hooks whose name escapes the hooks dir (F-002)', () => {
    const root = gitRepo({ '../owned': 'echo pwn', 'pre-commit': 'echo hi' })
    installHooks({ cwd: root, env: notCI, logger: silent })
    expect(fs.existsSync(path.join(root, 'owned'))).toBe(false)
    expect(fs.readdirSync(path.join(root, HOOKS_DIR))).toEqual(['pre-commit'])
  })

  it('refuses to write a hook through a pre-existing symlink (F-002)', () => {
    const root = gitRepo({ 'pre-commit': 'echo generated' })
    fs.mkdirSync(path.join(root, HOOKS_DIR))
    const outside = path.join(root, 'outside.txt')
    fs.writeFileSync(outside, 'original')
    fs.symlinkSync(outside, path.join(root, HOOKS_DIR, 'pre-commit'))
    installHooks({ cwd: root, env: notCI, logger: silent })
    expect(fs.readFileSync(outside, 'utf8')).toBe('original')
  })

  it('refuses to overwrite a same-named foreign hook file (F-003)', () => {
    const root = gitRepo({ 'pre-commit': 'echo generated' })
    fs.mkdirSync(path.join(root, HOOKS_DIR))
    fs.writeFileSync(path.join(root, HOOKS_DIR, 'pre-commit'), 'foreign data')
    installHooks({ cwd: root, env: notCI, logger: silent })
    expect(fs.readFileSync(path.join(root, HOOKS_DIR, 'pre-commit'), 'utf8')).toBe('foreign data')
  })

  it('reinstall clears stale generated hooks but preserves foreign files', () => {
    const root = gitRepo({ 'pre-commit': 'echo hi' })
    installHooks({ cwd: root, env: notCI, logger: silent })
    fs.writeFileSync(path.join(root, HOOKS_DIR, 'keep.txt'), 'user data')
    writeManifest(root, { 'pre-push': 'echo bye' })
    installHooks({ cwd: root, env: notCI, logger: silent })
    expect(fs.existsSync(path.join(root, HOOKS_DIR, 'pre-commit'))).toBe(false)
    expect(fs.existsSync(path.join(root, HOOKS_DIR, 'pre-push'))).toBe(true)
    expect(fs.existsSync(path.join(root, HOOKS_DIR, 'keep.txt'))).toBe(true)
  })

  it('handles an empty hook set', () => {
    const dir = gitRepo({})
    expect(installHooks({ cwd: dir, env: notCI, logger: silent })).toBe(true)
    expect(fs.readdirSync(path.join(dir, HOOKS_DIR))).toEqual([])
    expect(hooksPathOf(dir)).toBe(HOOKS_DIR)
  })

  it('is a no-op in CI', () => {
    const dir = gitRepo({ 'pre-commit': 'echo hi' })
    expect(installHooks({ cwd: dir, env: { CI: 'true' }, logger: silent })).toBe(false)
    expect(hooksPathOf(dir)).toBe('')
  })

  it('is a no-op outside a git work tree (env defaults to process.env)', () => {
    const dir = tmpdir()
    writeManifest(dir, { 'pre-commit': 'echo hi' })
    expect(installHooks({ cwd: dir, logger: silent })).toBe(false)
  })
})

describe('uninstallHooks', () => {
  it('unsets core.hooksPath and removes the generated dir', () => {
    const dir = gitRepo({ 'pre-commit': 'echo hi' })
    installHooks({ cwd: dir, env: notCI, logger: silent })
    expect(uninstallHooks({ cwd: dir, logger: silent })).toBe(true)
    expect(hooksPathOf(dir)).toBe('')
    expect(fs.existsSync(path.join(dir, HOOKS_DIR))).toBe(false)
  })

  it('removes only generated hooks, preserving foreign files and subdirs', () => {
    const dir = gitRepo({ 'pre-commit': 'echo hi' })
    installHooks({ cwd: dir, env: notCI, logger: silent })
    fs.writeFileSync(path.join(dir, HOOKS_DIR, 'keep.txt'), 'user data')
    fs.mkdirSync(path.join(dir, HOOKS_DIR, 'sub'))
    expect(uninstallHooks({ cwd: dir, logger: silent })).toBe(true)
    expect(fs.existsSync(path.join(dir, HOOKS_DIR, 'pre-commit'))).toBe(false)
    expect(fs.existsSync(path.join(dir, HOOKS_DIR, 'keep.txt'))).toBe(true)
    expect(fs.existsSync(path.join(dir, HOOKS_DIR, 'sub'))).toBe(true)
  })

  it('leaves a foreign .githooks dir untouched when it is not managed by us (F-003)', () => {
    const dir = gitRepo({ 'pre-commit': 'echo hi' })
    execFileSync('git', ['config', 'core.hooksPath', '.other'], { cwd: dir })
    fs.mkdirSync(path.join(dir, HOOKS_DIR))
    fs.writeFileSync(path.join(dir, HOOKS_DIR, 'keep.txt'), 'user data')
    expect(uninstallHooks({ cwd: dir, logger: silent })).toBe(false)
    expect(fs.existsSync(path.join(dir, HOOKS_DIR, 'keep.txt'))).toBe(true)
    expect(hooksPathOf(dir)).toBe('.other')
  })

  it('tolerates an already-missing hooks dir', () => {
    const dir = gitRepo({ 'pre-commit': 'echo hi' })
    installHooks({ cwd: dir, env: notCI, logger: silent })
    fs.rmSync(path.join(dir, HOOKS_DIR), { recursive: true, force: true })
    expect(uninstallHooks({ cwd: dir, logger: silent })).toBe(true)
    expect(hooksPathOf(dir)).toBe('')
  })

  it('is a no-op outside a git work tree', () => {
    expect(uninstallHooks({ cwd: tmpdir(), logger: silent })).toBe(false)
  })
})

describe('listHooks', () => {
  it('returns the configured hooks and reports core.hooksPath', () => {
    const dir = gitRepo({ 'pre-commit': 'echo hi' })
    installHooks({ cwd: dir, env: notCI, logger: silent })

    /** @type {string[]} */
    const lines = []
    const hooks = listHooks({ cwd: dir, logger: { info: m => lines.push(m) } })
    expect(hooks).toEqual({ 'pre-commit': 'echo hi' })
    expect(lines.some(l => l.includes(`core.hooksPath = ${HOOKS_DIR}`))).toBe(true)
    expect(lines.some(l => l.includes('pre-commit: echo hi'))).toBe(true)
  })

  it('reports an unset core.hooksPath outside a git work tree (falls back to cwd)', () => {
    const dir = tmpdir()
    writeManifest(dir, undefined)
    /** @type {string[]} */
    const lines = []
    listHooks({ cwd: dir, logger: { info: m => lines.push(m) } })
    expect(lines.some(l => l.includes('core.hooksPath = (unset)'))).toBe(true)
  })
})

describe('option defaults', () => {
  it('falls back to process.cwd()/process.env/console when options are omitted', () => {
    // A truthy CI flag short-circuits inside installHooks before any git/fs write, so exercising
    // the process.cwd()/console fallbacks here is safe against the real repository.
    expect(installHooks({ env: { CI: 'true' } })).toBe(false)
  })
})
