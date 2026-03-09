import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandHelpRenderer } from '../src/internal/help/command-help-renderer'
import type { ICommandOptionConfig, IHelpData } from '../src/types'

const ANSI_ESCAPE_REGEX = new RegExp(String.raw`\x1B\[[0-?]*[ -/]*[@-~]`, 'g')

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
  const normalized = value.replace(ANSI_ESCAPE_REGEX, '').normalize('NFC')
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

const BUILTIN_HELP_OPTION: ICommandOptionConfig = {
  long: 'help',
  type: 'boolean',
  args: 'none',
  desc: 'Show help information',
}

const BUILTIN_VERSION_OPTION: ICommandOptionConfig = {
  long: 'version',
  type: 'boolean',
  args: 'none',
  desc: 'Show version information',
}

function extractOptionLongNames(signatures: string[]): string[] {
  return signatures.map(sig => {
    const match = sig.match(/--([a-z][a-z0-9-]*)/)
    return match?.[1] ?? ''
  })
}

describe('CommandHelpRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should sort help/version first, then required options, then others', () => {
    const renderer = new CommandHelpRenderer()
    const helpData = renderer.buildHelpData({
      desc: 'cli',
      commandPath: 'cli',
      arguments: [],
      options: [
        { long: 'zeta', type: 'string', args: 'required', desc: 'zeta' },
        { long: 'alpha', type: 'string', args: 'required', desc: 'alpha', required: true },
        { long: 'beta', type: 'string', args: 'required', desc: 'beta', required: true },
        { long: 'gamma', type: 'boolean', args: 'none', desc: 'gamma' },
      ],
      supportsBuiltinVersion: true,
      subcommands: [],
      examples: [],
      builtinHelpOption: BUILTIN_HELP_OPTION,
      builtinVersionOption: BUILTIN_VERSION_OPTION,
    })

    const optionLongNames = extractOptionLongNames(helpData.options.map(item => item.sig))
    expect(optionLongNames).toEqual(['help', 'version', 'alpha', 'beta', 'gamma', 'zeta'])
  })

  it('should render commands with help first and subcommands sorted by name', () => {
    const renderer = new CommandHelpRenderer()
    const helpData = renderer.buildHelpData({
      desc: 'cli',
      commandPath: 'cli',
      arguments: [],
      options: [],
      supportsBuiltinVersion: false,
      subcommands: [
        { name: 'zeta', aliases: ['z'], desc: 'zeta cmd' },
        { name: 'alpha', aliases: ['a'], desc: 'alpha cmd' },
      ],
      examples: [],
      builtinHelpOption: BUILTIN_HELP_OPTION,
      builtinVersionOption: BUILTIN_VERSION_OPTION,
    })

    expect(helpData.commands.map(item => item.name)).toEqual(['help', 'alpha, a', 'zeta, z'])
  })

  it('should align plain help lines with ANSI, CJK and combining marks', () => {
    const renderer = new CommandHelpRenderer()
    const helpData: IHelpData = {
      desc: 'cli',
      usage: 'Usage: cli',
      arguments: [],
      options: [
        { sig: '\u001b[31m红\u001b[0m', desc: 'desc-a' },
        { sig: 'e\u0301', desc: 'desc-b' },
      ],
      commands: [],
      examples: [],
    }

    const output = renderer.formatHelp(helpData)
    const lineA = output.split('\n').find(line => line.includes('desc-a'))
    const lineB = output.split('\n').find(line => line.includes('desc-b'))

    const prefixA = lineA?.split('desc-a')[0]
    const prefixB = lineB?.split('desc-b')[0]

    expect(prefixA).toBeDefined()
    expect(prefixB).toBeDefined()
    expect(getDisplayWidth(prefixA ?? '')).toBe(getDisplayWidth(prefixB ?? ''))
  })

  it('should resolve help color from tokens and NO_COLOR, and reject invalid value', () => {
    const renderer = new CommandHelpRenderer()
    const options: ICommandOptionConfig[] = [
      {
        long: 'color',
        type: 'boolean',
        args: 'none',
        desc: 'color',
      },
    ]

    const fallbackColor = renderer.resolveHelpColorFromTailArgv({
      tailArgv: [],
      envs: { NO_COLOR: '1' },
      options,
      commandPath: 'cli',
    })
    expect(fallbackColor).toBe(false)

    const explicitColor = renderer.resolveHelpColorFromTailArgv({
      tailArgv: ['--color', '--', '--no-color'],
      envs: { NO_COLOR: '1' },
      options,
      commandPath: 'cli',
    })
    expect(explicitColor).toBe(true)

    expect(() =>
      renderer.resolveHelpColorFromTailArgv({
        tailArgv: ['--color=auto'],
        envs: {},
        options,
        commandPath: 'cli',
      }),
    ).toThrow('invalid value "auto" for boolean option "--color"')
  })

  it('should render usage/signatures for some and variadic args plus optional option value', () => {
    const renderer = new CommandHelpRenderer()
    const helpData = renderer.buildHelpData({
      desc: 'cli',
      commandPath: 'cli',
      arguments: [
        { name: 'files', kind: 'some', type: 'string', desc: 'files' },
        { name: 'rest', kind: 'variadic', type: 'string', desc: 'rest' },
      ],
      options: [{ long: 'output', type: 'string', args: 'optional', desc: 'output path' }],
      supportsBuiltinVersion: false,
      subcommands: [],
      examples: [],
      builtinHelpOption: BUILTIN_HELP_OPTION,
      builtinVersionOption: BUILTIN_VERSION_OPTION,
    })

    expect(helpData.usage).toContain('<files...>')
    expect(helpData.usage).toContain('[rest...]')
    expect(helpData.arguments.map(item => item.sig)).toEqual(['<files...>', '[rest...]'])
    expect(helpData.options.map(item => item.sig)).toContain('    --output [value]')
  })

  it('should render plain help when labels are empty and terminal help when tty is enabled', () => {
    const renderer = new CommandHelpRenderer()
    const helpData: IHelpData = {
      desc: 'cli',
      usage: 'Usage: cli',
      arguments: [],
      options: [],
      commands: [],
      examples: [],
    }

    const plain = renderer.formatHelp(helpData)
    expect(plain).toContain('Usage: cli')
    expect(plain).not.toContain('\u001b[')

    const isTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      enumerable: true,
      value: true,
      writable: true,
    })
    try {
      const terminal = renderer.formatHelpForDisplay(helpData, true)
      expect(terminal).toContain('\u001b[')
    } finally {
      if (isTTYDescriptor !== undefined) {
        Object.defineProperty(process.stdout, 'isTTY', isTTYDescriptor)
      }
    }
  })
})
