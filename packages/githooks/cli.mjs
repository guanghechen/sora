#!/usr/bin/env node
import { installHooks, listHooks, uninstallHooks } from './index.mjs'

const HELP = `githooks <command>

Commands:
  install     Generate configured hooks into .githooks/ and set core.hooksPath (default)
  uninstall   Remove generated hooks and unset core.hooksPath
  list        Print configured hooks and current core.hooksPath

Env:
  CI=1        Skip installation (intended for CI environments)
  GITHOOKS=0  Bypass a hook at runtime (e.g. git commit with hooks disabled)
`

/** @param {string[]} argv */
function main(argv) {
  const command = argv[0] ?? 'install'
  switch (command) {
    case 'install':
      installHooks()
      break
    case 'uninstall':
      uninstallHooks()
      break
    case 'list':
      listHooks()
      break
    case 'help':
    case '-h':
    case '--help':
      process.stdout.write(HELP)
      break
    default:
      process.stderr.write(`[githooks] unknown command: ${command}\n\n${HELP}`)
      process.exitCode = 1
  }
}

try {
  main(process.argv.slice(2))
} catch (error) {
  // Hooks are a dev convenience; never break `pnpm install` because of them.
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[githooks] failed: ${message}\n`)
}
