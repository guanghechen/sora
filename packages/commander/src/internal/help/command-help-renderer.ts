import { TERMINAL_STYLE, styleText } from '../../chalk'
import { CommanderError } from '../../types'
import type {
  ICommandArgumentConfig,
  ICommandExample,
  ICommandOptionConfig,
  IHelpArgumentLine,
  IHelpCommandLine,
  IHelpData,
  IHelpExampleLine,
  IHelpOptionLine,
} from '../../types'

const ANSI_ESCAPE_REGEX = new RegExp(String.raw`\x1B\[[0-?]*[ -/]*[@-~]`, 'g')

function camelToKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}

function isNoColorEnabled(envs: Record<string, string | undefined>): boolean {
  return envs['NO_COLOR'] !== undefined
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_REGEX, '')
}

/* v8 ignore start */
function isCombiningMark(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  )
}

function isWideCodePoint(codePoint: number): boolean {
  if (codePoint < 0x1100) {
    return false
  }

  return (
    codePoint <= 0x115f ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0x3247 && codePoint !== 0x303f) ||
    (codePoint >= 0x3250 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0xa4c6) ||
    (codePoint >= 0xa960 && codePoint <= 0xa97c) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6b) ||
    (codePoint >= 0xff01 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1b000 && codePoint <= 0x1b001) ||
    (codePoint >= 0x1f200 && codePoint <= 0x1f251) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  )
}

function getDisplayWidth(value: string): number {
  const normalized = stripAnsi(value).normalize('NFC')
  let width = 0

  for (const char of normalized) {
    const codePoint = char.codePointAt(0)
    if (codePoint === undefined || isCombiningMark(codePoint)) {
      continue
    }

    width += isWideCodePoint(codePoint) ? 2 : 1
  }

  return width
}
/* v8 ignore stop */

function padDisplayEnd(value: string, targetWidth: number): string {
  const width = getDisplayWidth(value)
  if (width >= targetWidth) {
    return value
  }
  return value + ' '.repeat(targetWidth - width)
}

export interface IHelpRendererSubcommand {
  name: string
  aliases: string[]
  desc: string
}

export interface IBuildHelpDataParams {
  desc: string
  commandPath: string
  arguments: ICommandArgumentConfig[]
  options: ICommandOptionConfig[]
  supportsBuiltinVersion: boolean
  subcommands: IHelpRendererSubcommand[]
  examples: ICommandExample[]
  builtinHelpOption: ICommandOptionConfig
  builtinVersionOption: ICommandOptionConfig
}

export interface IResolveHelpColorParams {
  tailArgv: string[]
  envs: Record<string, string | undefined>
  options: ICommandOptionConfig[]
  commandPath: string
}

export class CommandHelpRenderer {
  public buildHelpData(params: IBuildHelpDataParams): IHelpData {
    const allOptions: ICommandOptionConfig[] = [...params.options, params.builtinHelpOption]
    if (params.supportsBuiltinVersion) {
      allOptions.push(params.builtinVersionOption)
    }

    let usage = `Usage: ${params.commandPath}`
    if (allOptions.length > 0) usage += ' [options]'
    if (params.subcommands.length > 0) usage += ' [command]'
    for (const arg of params.arguments) {
      if (arg.kind === 'required') {
        usage += ` <${arg.name}>`
      } else if (arg.kind === 'optional') {
        usage += ` [${arg.name}]`
      } else if (arg.kind === 'some') {
        usage += ` <${arg.name}...>`
      } else {
        usage += ` [${arg.name}...]`
      }
    }

    const argumentsLines: IHelpArgumentLine[] = []
    for (const arg of params.arguments) {
      const sig =
        arg.kind === 'required'
          ? `<${arg.name}>`
          : arg.kind === 'optional'
            ? `[${arg.name}]`
            : arg.kind === 'some'
              ? `<${arg.name}...>`
              : `[${arg.name}...]`

      const metadata: string[] = [`[type: ${arg.type}]`]
      if (arg.kind === 'optional' && arg.default !== undefined) {
        metadata.push(`[default: ${JSON.stringify(arg.default)}]`)
      }
      if (arg.choices && arg.choices.length > 0) {
        metadata.push(`[choices: ${arg.choices.map(choice => JSON.stringify(choice)).join(', ')}]`)
      }

      const desc = metadata.length > 0 ? `${arg.desc} ${metadata.join(' ')}` : arg.desc
      argumentsLines.push({ sig, desc })
    }

    const sortedOptions = [...allOptions].sort((a, b) => {
      const optionRank = (option: ICommandOptionConfig): number => {
        if (option.long === 'help') {
          return 0
        }
        if (option.long === 'version') {
          return 1
        }
        if (option.required === true) {
          return 2
        }
        return 3
      }

      const rankA = optionRank(a)
      const rankB = optionRank(b)
      if (rankA !== rankB) {
        return rankA - rankB
      }

      return camelToKebabCase(a.long).localeCompare(camelToKebabCase(b.long))
    })

    const options: IHelpOptionLine[] = []
    for (const opt of sortedOptions) {
      const kebabLong = camelToKebabCase(opt.long)
      let sig = opt.short ? `-${opt.short}, ` : '    '
      sig += `--${kebabLong}`
      if (opt.args === 'optional') {
        sig += ' [value]'
      } else if (opt.args !== 'none') {
        sig += ' <value>'
      }

      let desc = opt.desc
      if (opt.default !== undefined && opt.type !== 'boolean') {
        desc += ` (default: ${JSON.stringify(opt.default)})`
      }
      if (opt.choices) {
        desc += ` [choices: ${opt.choices.map(choice => JSON.stringify(choice)).join(', ')}]`
      }

      options.push({ sig, desc })
    }

    const commands: IHelpCommandLine[] = []
    if (params.subcommands.length > 0) {
      commands.push({ name: 'help', desc: 'Show help for a command' })
    }
    const sortedSubcommands = [...params.subcommands].sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of sortedSubcommands) {
      let name = entry.name
      if (entry.aliases.length > 0) {
        name += `, ${entry.aliases.join(', ')}`
      }
      commands.push({ name, desc: entry.desc })
    }

    const examples: IHelpExampleLine[] = params.examples.map(example => ({
      title: example.title,
      usage: params.commandPath ? `${params.commandPath} ${example.usage}` : example.usage,
      desc: example.desc,
    }))

    return {
      desc: params.desc,
      usage,
      arguments: argumentsLines,
      options,
      commands,
      examples,
    }
  }

  public formatHelp(helpData: IHelpData): string {
    return this.#renderHelpPlain(helpData)
  }

  public formatHelpForDisplay(helpData: IHelpData, color: boolean): string {
    if (!this.#shouldRenderStyledHelp(color)) {
      return this.#renderHelpPlain(helpData)
    }
    return this.#renderHelpTerminal(helpData)
  }

  public resolveHelpColorFromTailArgv(params: IResolveHelpColorParams): boolean {
    const colorOption = params.options.find(opt => opt.long === 'color')
    let color = !isNoColorEnabled(params.envs)

    if (!colorOption || colorOption.type !== 'boolean' || colorOption.args !== 'none') {
      return color
    }

    const separatorIndex = params.tailArgv.indexOf('--')
    const scanTokens =
      separatorIndex === -1 ? params.tailArgv : params.tailArgv.slice(0, separatorIndex)

    for (const token of scanTokens) {
      if (token === '--color') {
        color = true
        continue
      }

      if (token === '--no-color') {
        color = false
        continue
      }

      if (!token.startsWith('--color=')) {
        continue
      }

      const value = token.slice('--color='.length)
      if (value === 'true') {
        color = true
      } else if (value === 'false') {
        color = false
      } else {
        throw new CommanderError(
          'InvalidBooleanValue',
          `invalid value "${value}" for boolean option "--color". Use "true" or "false"`,
          params.commandPath,
        )
      }
    }

    return color
  }

  #shouldRenderStyledHelp(color: boolean): boolean {
    return color && process.stdout.isTTY === true
  }

  #renderHelpPlain(helpData: IHelpData): string {
    const lines: string[] = []
    const labelWidth = this.#getHelpLabelWidth(helpData)

    lines.push(helpData.desc)
    lines.push('')

    lines.push(helpData.usage)
    lines.push('')

    if (helpData.arguments.length > 0) {
      lines.push('Arguments:')
      for (const { sig, desc } of helpData.arguments) {
        lines.push(this.#renderAlignedHelpLine(sig, desc, labelWidth))
      }
      lines.push('')
    }

    if (helpData.options.length > 0) {
      lines.push('Options:')
      for (const { sig, desc } of helpData.options) {
        lines.push(this.#renderAlignedHelpLine(sig, desc, labelWidth))
      }
      lines.push('')
    }

    if (helpData.commands.length > 0) {
      lines.push('Commands:')
      for (const { name, desc } of helpData.commands) {
        lines.push(this.#renderAlignedHelpLine(name, desc, labelWidth))
      }
      lines.push('')
    }

    if (helpData.examples.length > 0) {
      lines.push('Examples:')
      for (const example of helpData.examples) {
        lines.push(`  - ${example.title}`)
        lines.push(`    ${example.usage}`)
        lines.push(`    ${example.desc}`)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  #renderHelpTerminal(helpData: IHelpData): string {
    const lines: string[] = []
    const labelWidth = this.#getHelpLabelWidth(helpData)

    lines.push(helpData.desc)
    lines.push('')

    lines.push(styleText(helpData.usage, TERMINAL_STYLE.bold))
    lines.push('')

    if (helpData.arguments.length > 0) {
      lines.push(styleText('Arguments:', TERMINAL_STYLE.bold, TERMINAL_STYLE.underline))
      for (const { sig, desc } of helpData.arguments) {
        lines.push(
          this.#renderAlignedHelpLine(sig, desc, labelWidth, value =>
            styleText(value, TERMINAL_STYLE.cyan),
          ),
        )
      }
      lines.push('')
    }

    if (helpData.options.length > 0) {
      lines.push(styleText('Options:', TERMINAL_STYLE.bold, TERMINAL_STYLE.underline))
      for (const { sig, desc } of helpData.options) {
        lines.push(
          this.#renderAlignedHelpLine(sig, desc, labelWidth, value =>
            styleText(value, TERMINAL_STYLE.cyan),
          ),
        )
      }
      lines.push('')
    }

    if (helpData.commands.length > 0) {
      lines.push(styleText('Commands:', TERMINAL_STYLE.bold, TERMINAL_STYLE.underline))
      for (const { name, desc } of helpData.commands) {
        lines.push(
          this.#renderAlignedHelpLine(name, desc, labelWidth, value =>
            styleText(value, TERMINAL_STYLE.cyan),
          ),
        )
      }
      lines.push('')
    }

    if (helpData.examples.length > 0) {
      lines.push(styleText('Examples:', TERMINAL_STYLE.bold, TERMINAL_STYLE.underline))
      for (const example of helpData.examples) {
        lines.push(`  - ${styleText(example.title, TERMINAL_STYLE.bold)}`)
        lines.push(`    ${styleText(example.usage, TERMINAL_STYLE.cyan)}`)
        lines.push(`    ${styleText(example.desc, TERMINAL_STYLE.italic, TERMINAL_STYLE.dim)}`)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  #getHelpLabelWidth(helpData: IHelpData): number {
    const labels = [
      ...helpData.arguments.map(line => line.sig),
      ...helpData.options.map(line => line.sig),
      ...helpData.commands.map(line => line.name),
    ]
    if (labels.length === 0) {
      return 0
    }

    return Math.max(...labels.map(getDisplayWidth))
  }

  #renderAlignedHelpLine(
    label: string,
    desc: string,
    labelWidth: number,
    styleLabel?: (value: string) => string,
  ): string {
    const paddedLabel = padDisplayEnd(label, labelWidth)
    const outputLabel = styleLabel ? styleLabel(paddedLabel) : paddedLabel
    return `  ${outputLabel}  ${desc}`
  }
}
