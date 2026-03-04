/**
 * Shell completion generators
 *
 * @module @guanghechen/commander
 */

import fs from 'node:fs'
import path from 'node:path'
import { Command } from '../../command'
import { CommanderError } from '../../types'
import type {
  ICommandContext,
  ICompletionCommandConfig,
  ICompletionMeta,
  ICompletionPaths,
} from '../../types'

// ==================== Naming Utilities ====================

/**
 * Convert camelCase to kebab-case.
 */
function camelToKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}

const COMPLETION_SHELL_STATE = Symbol('completion-shell-state')

interface ICompletionShellState {
  shell?: keyof ICompletionPaths
}

function getCommandPath(ctx: ICommandContext): string {
  const names = ctx.chain
    .map(command => command.name)
    .filter((name): name is string => Boolean(name))
  if (names.length > 0) {
    return names.join(' ')
  }
  return ctx.cmd.name ?? 'command'
}

function getCompletionShellState(ctx: ICommandContext): ICompletionShellState {
  const host = ctx as ICommandContext & { [COMPLETION_SHELL_STATE]?: ICompletionShellState }
  host[COMPLETION_SHELL_STATE] ??= {}
  return host[COMPLETION_SHELL_STATE]
}

function registerCompletionShell(ctx: ICommandContext, shell: keyof ICompletionPaths): void {
  const state = getCompletionShellState(ctx)
  if (state.shell !== undefined && state.shell !== shell) {
    throw new CommanderError(
      'OptionConflict',
      'options "--bash", "--fish", and "--pwsh" are mutually exclusive',
      getCommandPath(ctx),
    )
  }
  state.shell = shell
}

function mustGetCompletionShell(ctx: ICommandContext): keyof ICompletionPaths {
  const state = getCompletionShellState(ctx)
  if (state.shell === undefined) {
    throw new CommanderError(
      'MissingRequired',
      'missing required option: one of "--bash", "--fish", or "--pwsh"',
      getCommandPath(ctx),
    )
  }
  return state.shell
}

// ==================== CompletionCommand ====================

/**
 * Built-in completion command that generates shell completion scripts.
 *
 * @example
 * ```typescript
 * const root = new Command({ name: 'mycli', desc: 'My CLI' })
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
  constructor(root: Command, config: ICompletionCommandConfig = {}) {
    const programName = config.programName ?? root.name ?? 'program'
    const paths: ICompletionPaths = {
      ...createDefaultCompletionPaths(programName),
      ...config.paths,
    }

    super({ desc: 'Generate shell completion script' })

    this.option({
      long: 'bash',
      type: 'boolean',
      args: 'none',
      desc: 'Generate Bash completion script',
      apply: (value, ctx) => {
        if (value === true) {
          registerCompletionShell(ctx, 'bash')
        }
      },
    })
      .option({
        long: 'fish',
        type: 'boolean',
        args: 'none',
        desc: 'Generate Fish completion script',
        apply: (value, ctx) => {
          if (value === true) {
            registerCompletionShell(ctx, 'fish')
          }
        },
      })
      .option({
        long: 'pwsh',
        type: 'boolean',
        args: 'none',
        desc: 'Generate PowerShell completion script',
        apply: (value, ctx) => {
          if (value === true) {
            registerCompletionShell(ctx, 'pwsh')
          }
          // Always validate after shell options are parsed.
          mustGetCompletionShell(ctx)
        },
      })
      .option({
        long: 'write',
        short: 'w',
        type: 'string',
        args: 'optional',
        desc: 'Write to file (use shell default path when value is omitted or empty)',
      })
      .action(({ opts, ctx }) => {
        const meta = root.getCompletionMeta()
        const shell = mustGetCompletionShell(ctx)
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

        const hasWrite = Object.prototype.hasOwnProperty.call(opts, 'write')
        if (hasWrite) {
          const writeOpt = opts['write']
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

function createDefaultCompletionPaths(programName: string): ICompletionPaths {
  return {
    bash: `~/.local/share/bash-completion/completions/${programName}`,
    fish: `~/.config/fish/completions/${programName}.fish`,
    pwsh: '~/.config/powershell/Microsoft.PowerShell_profile.ps1',
  }
}

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
      '  local opts arg_choices prefer_value_choices',
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

    // Build options string (including --no-{kebab-long} for boolean options).
    const optParts: string[] = []
    for (const opt of cmd.options) {
      const kebabLong = camelToKebabCase(opt.long)
      if (opt.short) optParts.push(this.#escapeWord(`-${opt.short}`))
      optParts.push(this.#escapeWord(`--${kebabLong}`))
      if (!opt.takesValue) {
        optParts.push(this.#escapeWord(`--no-${kebabLong}`))
      }
    }

    const subParts = cmd.subcommands
      .flatMap(sub => [sub.name, ...sub.aliases])
      .map(value => this.#escapeWord(value))

    const allOpts = [...optParts, ...subParts].join(' ')

    if (cmd.subcommands.length > 0) {
      lines.push(`${indent}case "\${words[${depth}]}" in`)

      for (const sub of cmd.subcommands) {
        const pattern = [sub.name, ...sub.aliases].join('|')
        lines.push(`${indent}  ${pattern})`)
        lines.push(...this.#generateCommandCase(sub, depth + 1))
        lines.push(`${indent}    ;;`)
      }

      lines.push(`${indent}  *)`)
      lines.push(`${indent}    opts="${allOpts}"`)
      this.#appendChoiceLogicForCommand(lines, `${indent}    `, cmd, depth)
      lines.push(`${indent}    ;;`)
      lines.push(`${indent}esac`)
    } else {
      lines.push(`${indent}opts="${allOpts}"`)
      this.#appendChoiceLogicForCommand(lines, indent, cmd, depth)
    }

    return lines
  }

  #serializeWordList(words: string[]): string {
    return words.map(choice => this.#escapeWord(choice)).join(' ')
  }

  #appendChoiceLogicForCommand(
    lines: string[],
    indent: string,
    cmd: ICompletionMeta,
    depth: number,
  ): void {
    const valueOptions = cmd.options.filter(opt => opt.takesValue)
    const valueOptionsWithChoices = valueOptions.filter(
      opt => opt.choices && opt.choices.length > 0,
    )
    const valueLongPatterns = valueOptions.map(opt => `--${camelToKebabCase(opt.long)}`)
    const valueShortPatterns = valueOptions
      .map(opt => opt.short)
      .filter((short): short is string => typeof short === 'string')

    lines.push(`${indent}prefer_value_choices=0`)

    if (valueOptionsWithChoices.length > 0) {
      lines.push(`${indent}if [[ "$cur" != -* ]]; then`)
      lines.push(`${indent}  case "$prev" in`)
      for (const opt of valueOptionsWithChoices) {
        const patterns = [`--${camelToKebabCase(opt.long)}`]
        if (opt.short) {
          patterns.push(`-${opt.short}`)
        }
        lines.push(`${indent}    ${patterns.join('|')})`)
        lines.push(`${indent}      opts="${this.#serializeWordList(opt.choices ?? [])}"`)
        lines.push(`${indent}      prefer_value_choices=1`)
        lines.push(`${indent}      ;;`)
      }
      lines.push(`${indent}  esac`)
      lines.push(`${indent}fi`)
    }

    lines.push(`${indent}if [[ $prefer_value_choices -eq 0 ]]; then`)
    lines.push(`${indent}  positional_count=0`)
    lines.push(`${indent}  expect_value=0`)
    lines.push(`${indent}  for ((idx=${depth}; idx<cword; idx++)); do`)
    lines.push(`${indent}    token="\${words[idx]}"`)
    lines.push(`${indent}    if [[ $expect_value -eq 1 ]]; then`)
    lines.push(`${indent}      expect_value=0`)
    lines.push(`${indent}      continue`)
    lines.push(`${indent}    fi`)
    lines.push(`${indent}    if [[ "$token" == --* ]]; then`)
    lines.push(`${indent}      if [[ "$token" == *=* ]]; then`)
    lines.push(`${indent}        continue`)
    lines.push(`${indent}      fi`)
    if (valueLongPatterns.length > 0) {
      lines.push(`${indent}      case "$token" in`)
      lines.push(`${indent}        ${valueLongPatterns.join('|')}) expect_value=1 ;;`)
      lines.push(`${indent}      esac`)
    }
    lines.push(`${indent}      continue`)
    lines.push(`${indent}    fi`)
    lines.push(`${indent}    if [[ "$token" == -* && "$token" != "-" ]]; then`)
    lines.push(`${indent}      if [[ \${#token} -eq 2 ]]; then`)
    if (valueShortPatterns.length > 0) {
      lines.push(`${indent}        case "\${token:1:1}" in`)
      lines.push(`${indent}          ${valueShortPatterns.join('|')}) expect_value=1 ;;`)
      lines.push(`${indent}        esac`)
    }
    lines.push(`${indent}      fi`)
    lines.push(`${indent}      continue`)
    lines.push(`${indent}    fi`)
    lines.push(`${indent}    positional_count=$((positional_count + 1))`)
    lines.push(`${indent}  done`)
    lines.push(`${indent}  if [[ $expect_value -eq 1 ]]; then`)
    lines.push(`${indent}    opts=""`)
    lines.push(`${indent}    prefer_value_choices=1`)
    lines.push(`${indent}  elif [[ "$cur" != -* ]]; then`)
    lines.push(`${indent}    arg_slot=-1`)
    lines.push(`${indent}    arg_count=${cmd.arguments.length}`)
    const hasRestArgument =
      cmd.arguments.length > 0 &&
      (cmd.arguments[cmd.arguments.length - 1].kind === 'variadic' ||
        cmd.arguments[cmd.arguments.length - 1].kind === 'some')
    lines.push(`${indent}    has_rest=${hasRestArgument ? 1 : 0}`)
    lines.push(
      `${indent}    if [[ $has_rest -eq 1 && $positional_count -ge $((arg_count - 1)) ]]; then`,
    )
    lines.push(`${indent}      arg_slot=$((arg_count - 1))`)
    lines.push(`${indent}    elif [[ $positional_count -lt $arg_count ]]; then`)
    lines.push(`${indent}      arg_slot=$positional_count`)
    lines.push(`${indent}    fi`)
    lines.push(`${indent}    case "$arg_slot" in`)
    for (let index = 0; index < cmd.arguments.length; index += 1) {
      const arg = cmd.arguments[index]
      if (arg.type !== 'choice' || !arg.choices || arg.choices.length === 0) {
        continue
      }

      lines.push(`${indent}      ${index}) opts="${this.#serializeWordList(arg.choices)}" ;;`)
    }
    lines.push(`${indent}    esac`)
    lines.push(`${indent}  fi`)
    lines.push(`${indent}fi`)
  }

  #escapeWord(word: string): string {
    return word.replace(/([\\\s'"`$!])/g, '\\$1')
  }

  #sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_')
  }
}

// ==================== FishCompletion ====================

export class FishCompletion {
  readonly #meta: ICompletionMeta
  readonly #programName: string
  readonly #slotMatcherName: string

  constructor(meta: ICompletionMeta, programName: string) {
    this.#meta = meta
    this.#programName = programName
    this.#slotMatcherName = `__${this.#sanitizeName(programName)}_match_arg_slot`
  }

  public generate(): string {
    const lines: string[] = [
      `# Fish completion for ${this.#programName}`,
      '# Generated by @guanghechen/commander',
      '',
      ...this.#generateSlotMatcherFunction(),
      '',
      ...this.#generateCommandCompletions(this.#meta, []),
      '',
    ]

    return lines.join('\n')
  }

  #generateCommandCompletions(cmd: ICompletionMeta, parentPath: string[][]): string[] {
    const lines: string[] = []
    const isRoot = parentPath.length === 0

    // Generate condition for this command level
    const condition = this.#buildCondition(parentPath)

    // Generate option completions
    for (const opt of cmd.options) {
      const kebabLong = camelToKebabCase(opt.long)
      let line = `complete -c ${this.#programName}`
      if (condition) line += ` -n '${condition}'`
      if (opt.short) line += ` -s ${opt.short}`
      line += ` -l ${kebabLong}`
      line += ` -d '${this.#escape(opt.desc)}'`
      if (opt.choices && opt.choices.length > 0) {
        line += ` -xa '${opt.choices.map(choice => this.#escapeChoice(choice)).join(' ')}'`
      }
      lines.push(line)

      // Add --no-{kebab-long} for boolean options (reuse original description per spec)
      if (!opt.takesValue) {
        let noLine = `complete -c ${this.#programName}`
        if (condition) noLine += ` -n '${condition}'`
        noLine += ` -l no-${kebabLong}`
        noLine += ` -d '${this.#escape(opt.desc)}'`
        lines.push(noLine)
      }
    }

    const valueOptionLongs = cmd.options
      .filter(opt => opt.takesValue)
      .map(opt => camelToKebabCase(opt.long))
      .join(',')
    const valueOptionShorts = cmd.options
      .filter(opt => opt.takesValue && opt.short)
      .map(opt => opt.short as string)
      .join(',')
    const argCount = cmd.arguments.length
    const hasRestArgument =
      argCount > 0 &&
      (cmd.arguments[argCount - 1].kind === 'variadic' ||
        cmd.arguments[argCount - 1].kind === 'some')

    for (let index = 0; index < cmd.arguments.length; index += 1) {
      const arg = cmd.arguments[index]
      if (arg.type !== 'choice' || !arg.choices || arg.choices.length === 0) {
        continue
      }

      let line = `complete -c ${this.#programName}`
      const slotCondition = `${this.#slotMatcherName} ${parentPath.length} ${argCount} ${
        hasRestArgument ? 1 : 0
      } ${index} '${valueOptionLongs}' '${valueOptionShorts}'`
      if (condition) {
        line += ` -n '${condition}; and ${slotCondition}'`
      } else {
        line += ` -n '${slotCondition}'`
      }
      line += ` -f`
      line += ` -a '${arg.choices.map(choice => this.#escapeChoice(choice)).join(' ')}'`
      line += ` -d '${this.#escape(`Argument: ${arg.name}`)}'`
      lines.push(line)
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
      line += ` -d '${this.#escape(sub.desc)}'`
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
      const newPath = [...parentPath, [sub.name, ...sub.aliases]]
      lines.push(...this.#generateCommandCompletions(sub, newPath))
    }

    return lines
  }

  #buildCondition(path: string[][]): string {
    if (path.length === 0) return ''
    return path.map(level => `__fish_seen_subcommand_from ${level.join(' ')}`).join('; and ')
  }

  #getSubcommandNames(cmd: ICompletionMeta): string[] {
    return cmd.subcommands.flatMap(sub => [sub.name, ...sub.aliases])
  }

  #escape(s: string): string {
    return s.replace(/'/g, "\\'")
  }

  #escapeChoice(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\s/g, '\\ ')
  }

  #sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_')
  }

  #generateSlotMatcherFunction(): string[] {
    return [
      `function ${this.#slotMatcherName} --argument-names depth arg_count has_rest target_index long_opts short_opts`,
      '  set -l tokens (commandline -opc)',
      '  set -l start (math $depth + 2)',
      '  set -l positional 0',
      '  set -l expect_value 0',
      '  set -l i $start',
      '  set -l token_count (count $tokens)',
      '  set -l long_list (string split "," -- $long_opts)',
      '  set -l short_list (string split "," -- $short_opts)',
      '  while test $i -le $token_count',
      '    set -l token $tokens[$i]',
      '    if test $expect_value -eq 1',
      '      set expect_value 0',
      '      set i (math $i + 1)',
      '      continue',
      '    end',
      '    if string match -q -- "--*" $token',
      '      if string match -q -- "*=*" $token',
      '        set i (math $i + 1)',
      '        continue',
      '      end',
      '      set -l opt_name (string replace -r "^--" "" -- $token)',
      '      if contains -- $opt_name $long_list',
      '        set expect_value 1',
      '      end',
      '      set i (math $i + 1)',
      '      continue',
      '    end',
      '    if test "$token" != "-"; and string match -q -- "-*" $token',
      '      set -l raw_short (string replace -r "^-" "" -- $token)',
      '      if test (string length -- $raw_short) -eq 1',
      '        if contains -- $raw_short $short_list',
      '          set expect_value 1',
      '        end',
      '      end',
      '      set i (math $i + 1)',
      '      continue',
      '    end',
      '    set positional (math $positional + 1)',
      '    set i (math $i + 1)',
      '  end',
      '  if test $expect_value -eq 1',
      '    return 1',
      '  end',
      '  set -l slot -1',
      '  if test $has_rest -eq 1; and test $positional -ge (math $arg_count - 1)',
      '    set slot (math $arg_count - 1)',
      '  else if test $positional -lt $arg_count',
      '    set slot $positional',
      '  end',
      '  test $slot -eq $target_index',
      'end',
    ]
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
      '  $commandDepth = 1',
      '  foreach ($word in $words[1..($words.Count - 1)]) {',
      '    if ($word.StartsWith("-")) { continue }',
      '    if ($cmd.subcommands -and $cmd.subcommands.ContainsKey($word)) {',
      '      $cmd = $cmd.subcommands[$word]',
      '      $commandDepth += 1',
      '    }',
      '  }',
      '',
      '  # Generate completions',
      '  $completions = @()',
      '',
      '  # Option value slot (always higher priority than arguments)',
      '  $previous = if ($words.Count -ge 2) { $words[$words.Count - 2] } else { $null }',
      '  if ($previous) {',
      '    foreach ($opt in $cmd.options) {',
      '      $isLong = $previous -eq "--$($opt.long)"',
      '      $isShort = $opt.short -and $previous -eq "-$($opt.short)"',
      '      if ($isLong -or $isShort) {',
      '        if ($opt.choices) {',
      '          foreach ($choice in $opt.choices) {',
      '            if ($choice -like "$current*") {',
      '              $completions += [System.Management.Automation.CompletionResult]::new(',
      '                $choice,',
      '                $choice,',
      '                "ParameterValue",',
      '                $choice',
      '              )',
      '            }',
      '          }',
      '        }',
      '        return $completions',
      '      }',
      '    }',
      '  }',
      '',
      '  # Determine argument slot',
      '  $positionalCount = 0',
      '  $expectValue = $false',
      '  for ($i = $commandDepth; $i -lt ($words.Count - 1); $i += 1) {',
      '    $token = $words[$i]',
      '    if ($expectValue) {',
      '      $expectValue = $false',
      '      continue',
      '    }',
      '    if ($token.StartsWith("--")) {',
      '      if ($token.Contains("=")) { continue }',
      '      foreach ($opt in $cmd.options) {',
      '        if ($token -eq "--$($opt.long)" -and $opt.takesValue) {',
      '          $expectValue = $true',
      '          break',
      '        }',
      '      }',
      '      continue',
      '    }',
      '    if ($token.StartsWith("-") -and $token -ne "-") {',
      '      if ($token.Length -eq 2) {',
      '        foreach ($opt in $cmd.options) {',
      '          if ($opt.short -and $token -eq "-$($opt.short)" -and $opt.takesValue) {',
      '            $expectValue = $true',
      '            break',
      '          }',
      '        }',
      '      }',
      '      continue',
      '    }',
      '    $positionalCount += 1',
      '  }',
      '  if ($expectValue) {',
      '    return $completions',
      '  }',
      '  if (-not $current.StartsWith("-") -and $cmd.arguments -and $cmd.arguments.Count -gt 0) {',
      '    $argSlot = -1',
      '    $argCount = $cmd.arguments.Count',
      '    $lastArg = $cmd.arguments[$argCount - 1]',
      '    $hasRest = $lastArg.kind -eq "variadic" -or $lastArg.kind -eq "some"',
      '    if ($hasRest -and $positionalCount -ge ($argCount - 1)) {',
      '      $argSlot = $argCount - 1',
      '    } elseif ($positionalCount -lt $argCount) {',
      '      $argSlot = $positionalCount',
      '    }',
      '    if ($argSlot -ge 0) {',
      '      $argMeta = $cmd.arguments[$argSlot]',
      '      if ($argMeta.choices) {',
      '        foreach ($choice in $argMeta.choices) {',
      '          if ($choice -like "$current*") {',
      '            $completions += [System.Management.Automation.CompletionResult]::new(',
      '              $choice,',
      '              $choice,',
      '              "ParameterValue",',
      '              $choice',
      '            )',
      '          }',
      '        }',
      '        return $completions',
      '      }',
      '    }',
      '  }',
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

    lines.push(`${indent}description = '${this.#escape(cmd.desc)}'`)

    // Options
    lines.push(`${indent}options = @(`)
    for (const opt of cmd.options) {
      const kebabLong = camelToKebabCase(opt.long)
      lines.push(`${indent}  @{`)
      if (opt.short) lines.push(`${indent}    short = '${opt.short}'`)
      lines.push(`${indent}    long = '${kebabLong}'`)
      lines.push(`${indent}    description = '${this.#escape(opt.desc)}'`)
      lines.push(`${indent}    isBoolean = $${!opt.takesValue}`)
      lines.push(`${indent}    takesValue = $${opt.takesValue}`)
      if (opt.choices) {
        lines.push(
          `${indent}    choices = @('${opt.choices
            .map(choice => this.#escape(choice))
            .join("', '")}')`,
        )
      }
      lines.push(`${indent}  }`)
    }
    lines.push(`${indent})`)

    // Arguments
    lines.push(`${indent}arguments = @(`)
    for (const arg of cmd.arguments) {
      lines.push(`${indent}  @{`)
      lines.push(`${indent}    name = '${this.#escape(arg.name)}'`)
      lines.push(`${indent}    kind = '${arg.kind}'`)
      lines.push(`${indent}    type = '${arg.type}'`)
      if (arg.choices && arg.choices.length > 0) {
        lines.push(
          `${indent}    choices = @('${arg.choices
            .map(choice => this.#escape(choice))
            .join("', '")}')`,
        )
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
