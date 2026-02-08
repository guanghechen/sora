/**
 * Shell completion generators
 *
 * @module @guanghechen/commander
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { Command } from './command'
import type { ICompletionCommandConfig, ICompletionMeta, ICompletionPaths } from './types'

// ==================== CompletionCommand ====================

/**
 * Built-in completion command that generates shell completion scripts.
 *
 * @example
 * ```typescript
 * const root = new Command({ name: 'mycli', description: 'My CLI' })
 * root.subcommand('completion', new CompletionCommand(root, {
 *   paths: {
 *     bash: `~/.local/share/bash-completion/completions/mycli`,
 *     fish: `~/.config/fish/completions/mycli.fish`,
 *     pwsh: `~/.config/powershell/Microsoft.PowerShell_profile.ps1`,
 *   }
 * }))
 *
 * // Usage:
 * // mycli completion --bash > ~/.local/share/bash-completion/completions/mycli
 * // mycli completion --fish --write  (writes to default path)
 * // mycli completion --fish --write /custom/path.fish
 * ```
 */
export class CompletionCommand extends Command {
  constructor(root: Command, config: ICompletionCommandConfig) {
    const paths = config.paths
    const programName = config.programName ?? root.name

    super({
      description: 'Generate shell completion script',
    })

    this.option({
      long: 'bash',
      type: 'boolean',
      description: 'Generate Bash completion script',
    })
      .option({
        long: 'fish',
        type: 'boolean',
        description: 'Generate Fish completion script',
      })
      .option({
        long: 'pwsh',
        type: 'boolean',
        description: 'Generate PowerShell completion script',
      })
      .option({
        long: 'write',
        short: 'w',
        type: 'string',
        description: 'Write to file (default path if no value given)',
        resolver: argv => resolveOptionalStringOption(argv, 'write', 'w'),
      })
      .action(({ opts }) => {
        const meta = root.getCompletionMeta()

        const selectedShells = [
          opts['bash'] && 'bash',
          opts['fish'] && 'fish',
          opts['pwsh'] && 'pwsh',
        ].filter(Boolean) as Array<keyof ICompletionPaths>

        if (selectedShells.length === 0) {
          console.error('Please specify a shell: --bash, --fish, or --pwsh')
          process.exit(1)
          return
        }

        if (selectedShells.length > 1) {
          console.error('Please specify only one shell option')
          process.exit(1)
          return
        }

        const shell = selectedShells[0]
        let script: string

        switch (shell) {
          case 'bash':
            script = new BashCompletion(meta, programName).generate()
            break
          case 'fish':
            script = new FishCompletion(meta, programName).generate()
            break
          case 'pwsh':
            script = new PwshCompletion(meta, programName).generate()
            break
        }

        const writeOpt = opts['write']
        if (writeOpt !== undefined) {
          // --write was specified
          const filePath = typeof writeOpt === 'string' && writeOpt !== '' ? writeOpt : paths[shell]
          const expandedPath = expandHome(filePath)

          // Ensure parent directory exists
          const dir = path.dirname(expandedPath)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }

          fs.writeFileSync(expandedPath, script, 'utf-8')
          console.log(`Completion script written to: ${expandedPath}`)
        } else {
          // Output to stdout
          console.log(script)
        }
      })
  }
}

// ==================== Helper Functions ====================

/**
 * Expand ~ to home directory
 */
function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    const home = process.env['HOME'] || process.env['USERPROFILE'] || ''
    return filepath.replace(/^~/, home)
  }
  return filepath
}

/**
 * Resolve an optional string option that can be:
 * - Not present: undefined
 * - Present without value (--write): empty string '' to indicate "use default"
 * - Present with value (--write /path): the value
 */
function resolveOptionalStringOption(
  argv: string[],
  longName: string,
  shortName?: string,
): { value: string | undefined; remaining: string[] } {
  const remaining: string[] = []
  let value: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    // Check --long=value
    if (arg.startsWith(`--${longName}=`)) {
      value = arg.slice(`--${longName}=`.length)
      continue
    }

    // Check --long or --long value
    if (arg === `--${longName}`) {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        value = next
        i += 1
      } else {
        value = '' // Flag present but no value
      }
      continue
    }

    // Check -w=value
    if (shortName && arg.startsWith(`-${shortName}=`)) {
      value = arg.slice(`-${shortName}=`.length)
      continue
    }

    // Check -w or -w value
    if (shortName && arg === `-${shortName}`) {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) {
        value = next
        i += 1
      } else {
        value = ''
      }
      continue
    }

    remaining.push(arg)
  }

  return { value, remaining }
}

// ==================== BashCompletion ====================

export class BashCompletion {
  readonly #meta: ICompletionMeta
  readonly #programName: string

  constructor(meta: ICompletionMeta, programName: string) {
    this.#meta = meta
    this.#programName = programName
  }

  public generate(): string {
    const funcName = `_${this.#sanitizeName(this.#programName)}_completions`

    const lines: string[] = [
      `# Bash completion for ${this.#programName}`,
      '# Generated by @guanghechen/commander',
      '',
      `${funcName}() {`,
      '  local cur prev words cword',
      '  _init_completion || return',
      '',
      ...this.#generateCommandCase(this.#meta, 1),
      '',
      '  COMPREPLY=($(compgen -W "$opts" -- "$cur"))',
      '}',
      '',
      `complete -F ${funcName} ${this.#programName}`,
      '',
    ]

    return lines.join('\n')
  }

  #generateCommandCase(cmd: ICompletionMeta, depth: number): string[] {
    const indent = '  '.repeat(depth)
    const lines: string[] = []

    // Build options string (including --no-{long} for boolean options)
    const optParts: string[] = []
    for (const opt of cmd.options) {
      if (opt.short) optParts.push(`-${opt.short}`)
      optParts.push(`--${opt.long}`)
      if (!opt.takesValue) {
        // Boolean option - add negative form
        optParts.push(`--no-${opt.long}`)
      }
    }

    // Build subcommands string
    const subParts = cmd.subcommands.flatMap(sub => [sub.name, ...sub.aliases])

    const allOpts = [...optParts, ...subParts].join(' ')

    if (cmd.subcommands.length > 0) {
      // Has subcommands - use case statement
      lines.push(`${indent}case "\${words[${depth}]}" in`)

      for (const sub of cmd.subcommands) {
        const pattern = [sub.name, ...sub.aliases].join('|')
        lines.push(`${indent}  ${pattern})`)
        lines.push(...this.#generateCommandCase(sub, depth + 1))
        lines.push(`${indent}    ;;`)
      }

      lines.push(`${indent}  *)`)
      lines.push(`${indent}    opts="${allOpts}"`)
      lines.push(`${indent}    ;;`)
      lines.push(`${indent}esac`)
    } else {
      // Leaf command
      lines.push(`${indent}opts="${allOpts}"`)
    }

    return lines
  }

  #sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_')
  }
}

// ==================== FishCompletion ====================

export class FishCompletion {
  readonly #meta: ICompletionMeta
  readonly #programName: string

  constructor(meta: ICompletionMeta, programName: string) {
    this.#meta = meta
    this.#programName = programName
  }

  public generate(): string {
    const lines: string[] = [
      `# Fish completion for ${this.#programName}`,
      '# Generated by @guanghechen/commander',
      '',
      ...this.#generateCommandCompletions(this.#meta, []),
      '',
    ]

    return lines.join('\n')
  }

  #generateCommandCompletions(cmd: ICompletionMeta, parentPath: string[]): string[] {
    const lines: string[] = []
    const isRoot = parentPath.length === 0

    // Generate condition for this command level
    const condition = this.#buildCondition(parentPath)

    // Generate option completions
    for (const opt of cmd.options) {
      let line = `complete -c ${this.#programName}`
      if (condition) line += ` -n '${condition}'`
      if (opt.short) line += ` -s ${opt.short}`
      line += ` -l ${opt.long}`
      line += ` -d '${this.#escape(opt.description)}'`
      if (opt.choices && opt.choices.length > 0) {
        line += ` -xa '${opt.choices.join(' ')}'`
      }
      lines.push(line)

      // Add --no-{long} for boolean options (reuse original description per spec)
      if (!opt.takesValue) {
        let noLine = `complete -c ${this.#programName}`
        if (condition) noLine += ` -n '${condition}'`
        noLine += ` -l no-${opt.long}`
        noLine += ` -d '${this.#escape(opt.description)}'`
        lines.push(noLine)
      }
    }

    // Generate subcommand completions
    for (const sub of cmd.subcommands) {
      // Main name
      let line = `complete -c ${this.#programName}`
      if (isRoot) {
        line += ' -n __fish_use_subcommand'
      } else if (condition) {
        line += ` -n '${condition}; and not __fish_seen_subcommand_from ${this.#getSubcommandNames(cmd).join(' ')}'`
      }
      line += ` -a ${sub.name}`
      line += ` -d '${this.#escape(sub.description)}'`
      lines.push(line)

      // Aliases
      for (const alias of sub.aliases) {
        let aliasLine = `complete -c ${this.#programName}`
        if (isRoot) {
          aliasLine += ' -n __fish_use_subcommand'
        } else if (condition) {
          aliasLine += ` -n '${condition}; and not __fish_seen_subcommand_from ${this.#getSubcommandNames(cmd).join(' ')}'`
        }
        aliasLine += ` -a ${alias}`
        aliasLine += ` -d 'Alias for ${sub.name}'`
        lines.push(aliasLine)
      }

      // Recurse into subcommand
      const newPath = [...parentPath, sub.name]
      lines.push(...this.#generateCommandCompletions(sub, newPath))
    }

    return lines
  }

  #buildCondition(path: string[]): string {
    if (path.length === 0) return ''
    return `__fish_seen_subcommand_from ${path[path.length - 1]}`
  }

  #getSubcommandNames(cmd: ICompletionMeta): string[] {
    return cmd.subcommands.flatMap(sub => [sub.name, ...sub.aliases])
  }

  #escape(s: string): string {
    return s.replace(/'/g, "\\'")
  }
}

// ==================== PwshCompletion ====================

export class PwshCompletion {
  readonly #meta: ICompletionMeta
  readonly #programName: string

  constructor(meta: ICompletionMeta, programName: string) {
    this.#meta = meta
    this.#programName = programName
  }

  public generate(): string {
    const lines: string[] = [
      `# PowerShell completion for ${this.#programName}`,
      '# Generated by @guanghechen/commander',
      '',
      `Register-ArgumentCompleter -Native -CommandName ${this.#programName} -ScriptBlock {`,
      '  param($wordToComplete, $commandAst, $cursorPosition)',
      '',
      '  $commands = @{',
      this.#generateCommandHash(this.#meta, '    '),
      '  }',
      '',
      '  $words = $commandAst.CommandElements | ForEach-Object { $_.ToString() }',
      '  $current = $wordToComplete',
      '',
      '  # Find current command context',
      '  $cmd = $commands',
      '  foreach ($word in $words[1..($words.Count - 1)]) {',
      '    if ($word.StartsWith("-")) { continue }',
      '    if ($cmd.subcommands -and $cmd.subcommands.ContainsKey($word)) {',
      '      $cmd = $cmd.subcommands[$word]',
      '    }',
      '  }',
      '',
      '  # Generate completions',
      '  $completions = @()',
      '',
      '  # Options',
      '  if ($current.StartsWith("-")) {',
      '    foreach ($opt in $cmd.options) {',
      '      if ("--$($opt.long)" -like "$current*") {',
      '        $completions += [System.Management.Automation.CompletionResult]::new(',
      '          "--$($opt.long)",',
      '          $opt.long,',
      '          "ParameterName",',
      '          $opt.description',
      '        )',
      '      }',
      '      if ($opt.isBoolean -and "--no-$($opt.long)" -like "$current*") {',
      '        $completions += [System.Management.Automation.CompletionResult]::new(',
      '          "--no-$($opt.long)",',
      '          "no-$($opt.long)",',
      '          "ParameterName",',
      '          $opt.description',
      '        )',
      '      }',
      '      if ($opt.short -and "-$($opt.short)" -like "$current*") {',
      '        $completions += [System.Management.Automation.CompletionResult]::new(',
      '          "-$($opt.short)",',
      '          $opt.short,',
      '          "ParameterName",',
      '          $opt.description',
      '        )',
      '      }',
      '    }',
      '  }',
      '',
      '  # Subcommands',
      '  if ($cmd.subcommands) {',
      '    foreach ($sub in $cmd.subcommands.Keys) {',
      '      if ($sub -like "$current*") {',
      '        $completions += [System.Management.Automation.CompletionResult]::new(',
      '          $sub,',
      '          $sub,',
      '          "Command",',
      '          $cmd.subcommands[$sub].description',
      '        )',
      '      }',
      '    }',
      '  }',
      '',
      '  return $completions',
      '}',
      '',
    ]

    return lines.join('\n')
  }

  #generateCommandHash(cmd: ICompletionMeta, indent: string): string {
    const lines: string[] = []

    lines.push(`${indent}description = '${this.#escape(cmd.description)}'`)

    // Options
    lines.push(`${indent}options = @(`)
    for (const opt of cmd.options) {
      lines.push(`${indent}  @{`)
      if (opt.short) lines.push(`${indent}    short = '${opt.short}'`)
      lines.push(`${indent}    long = '${opt.long}'`)
      lines.push(`${indent}    description = '${this.#escape(opt.description)}'`)
      lines.push(`${indent}    isBoolean = $${!opt.takesValue}`)
      if (opt.choices) {
        lines.push(`${indent}    choices = @('${opt.choices.join("', '")}')`)
      }
      lines.push(`${indent}  }`)
    }
    lines.push(`${indent})`)

    // Subcommands
    if (cmd.subcommands.length > 0) {
      lines.push(`${indent}subcommands = @{`)
      for (const sub of cmd.subcommands) {
        lines.push(`${indent}  '${sub.name}' = @{`)
        lines.push(this.#generateCommandHash(sub, `${indent}    `))
        lines.push(`${indent}  }`)
        // Add aliases
        for (const alias of sub.aliases) {
          lines.push(`${indent}  '${alias}' = @{`)
          lines.push(this.#generateCommandHash(sub, `${indent}    `))
          lines.push(`${indent}  }`)
        }
      }
      lines.push(`${indent}}`)
    }

    return lines.join('\n')
  }

  #escape(s: string): string {
    return s.replace(/'/g, "''")
  }
}
