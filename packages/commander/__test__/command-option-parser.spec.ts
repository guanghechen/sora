import { describe, expect, it } from 'vitest'
import { CommandOptionParser } from '../src/internal/parse/command-option-parser'
import type { ICommandOptionConfig, ICommandToken } from '../src/types'

function longToken(original: string, resolved: string, name: string): ICommandToken {
  return {
    original,
    resolved,
    name,
    type: 'long',
    source: 'user',
  }
}

function noneToken(value: string): ICommandToken {
  return {
    original: value,
    resolved: value,
    name: '',
    type: 'none',
    source: 'user',
  }
}

describe('CommandOptionParser', () => {
  it('should parse options and apply NO_COLOR fallback when color token is absent', () => {
    const parser = new CommandOptionParser()
    const allOptions: ICommandOptionConfig[] = [
      { long: 'color', type: 'boolean', args: 'none', desc: 'color', default: true },
      { long: 'devmode', type: 'boolean', args: 'none', desc: 'devmode' },
      { long: 'logLevel', type: 'string', args: 'required', desc: 'log level' },
      { long: 'tags', type: 'string', args: 'variadic', desc: 'tags' },
    ]

    const result = parser.parseOptions({
      tokens: [
        longToken('--devmode', '--devmode', 'devmode'),
        longToken('--log-level', '--logLevel', 'logLevel'),
        noneToken('debug'),
        longToken('--tags', '--tags', 'tags'),
        noneToken('a'),
        noneToken('b'),
      ],
      allOptions,
      envs: { NO_COLOR: '1' },
      commandPath: 'cli',
    })

    expect(result.opts).toMatchObject({
      color: false,
      devmode: true,
      logLevel: 'debug',
      tags: ['a', 'b'],
    })
    expect(result.explicitOptionLongs.has('devmode')).toBe(true)
    expect(result.explicitOptionLongs.has('logLevel')).toBe(true)
  })

  it('should throw for invalid boolean inline value', () => {
    const parser = new CommandOptionParser()
    const allOptions: ICommandOptionConfig[] = [
      { long: 'devmode', type: 'boolean', args: 'none', desc: 'devmode' },
    ]

    expect(() =>
      parser.parseOptions({
        tokens: [longToken('--devmode=auto', '--devmode=auto', 'devmode')],
        allOptions,
        envs: {},
        commandPath: 'cli',
      }),
    ).toThrow('invalid value "auto" for boolean option "--devmode"')
  })

  it('should handle builtin devmode/logLevel coupling and builtin snapshot exposure', () => {
    const parser = new CommandOptionParser()
    const opts = { devmode: true } as Record<string, unknown>
    const explicitOptionLongs = new Set<string>()

    parser.applyBuiltinDevmodeLogLevel({
      opts,
      explicitOptionLongs,
      builtinOption: {
        version: true,
        color: true,
        devmode: true,
        logLevel: true,
        silent: true,
        logDate: true,
        logColorful: true,
      },
      hasUserOption: () => false,
    })

    expect(opts['logLevel']).toBe('debug')

    const builtin = parser.resolveBuiltinParsedOptions({
      opts,
      builtinOption: {
        version: true,
        color: true,
        devmode: true,
        logLevel: true,
        silent: true,
        logDate: true,
        logColorful: true,
      },
      hasUserOption: long => long === 'color',
    })

    expect(builtin).toEqual({
      devmode: true,
      logLevel: 'debug',
      silent: false,
      logDate: false,
      logColorful: false,
    })
  })
})
