import { describe, expect, it } from 'vitest'
import {
  Chalk,
  ColorSupportLevelEnum,
  ansi256ToAnsi,
  hex2ansi,
  hex2ansi256,
  hex2rgb,
  rgb2ansi,
  rgb2ansi256,
  rgb2hex,
} from '../src'

describe('ansi256ToAnsi', () => {
  it('should convert standard colors (0-7) to ANSI 30-37', () => {
    expect(ansi256ToAnsi(0)).toBe(30)
    expect(ansi256ToAnsi(1)).toBe(31)
    expect(ansi256ToAnsi(2)).toBe(32)
    expect(ansi256ToAnsi(3)).toBe(33)
    expect(ansi256ToAnsi(4)).toBe(34)
    expect(ansi256ToAnsi(5)).toBe(35)
    expect(ansi256ToAnsi(6)).toBe(36)
    expect(ansi256ToAnsi(7)).toBe(37)
  })

  it('should convert bright colors (8-15) to ANSI 90-97', () => {
    expect(ansi256ToAnsi(8)).toBe(90)
    expect(ansi256ToAnsi(9)).toBe(91)
    expect(ansi256ToAnsi(10)).toBe(92)
    expect(ansi256ToAnsi(11)).toBe(93)
    expect(ansi256ToAnsi(12)).toBe(94)
    expect(ansi256ToAnsi(13)).toBe(95)
    expect(ansi256ToAnsi(14)).toBe(96)
    expect(ansi256ToAnsi(15)).toBe(97)
  })

  it('should convert grayscale colors (232-255) correctly', () => {
    expect(ansi256ToAnsi(232)).toBe(30)
    expect(ansi256ToAnsi(244)).toBe(37)
    expect(ansi256ToAnsi(255)).toBe(37)
  })

  it('should convert 6x6x6 color cube (16-231) correctly', () => {
    expect(ansi256ToAnsi(16)).toBe(30)
    expect(ansi256ToAnsi(196)).toBe(91)
    expect(ansi256ToAnsi(46)).toBe(92)
    expect(ansi256ToAnsi(21)).toBe(94)
    expect(ansi256ToAnsi(201)).toBe(95)
    expect(ansi256ToAnsi(51)).toBe(96)
    expect(ansi256ToAnsi(231)).toBe(97)
  })
})

describe('hex2rgb', () => {
  it('should convert 3-digit hex to RGB', () => {
    expect(hex2rgb('fff')).toEqual([255, 255, 255])
    expect(hex2rgb('000')).toEqual([0, 0, 0])
    expect(hex2rgb('f00')).toEqual([255, 0, 0])
    expect(hex2rgb('0f0')).toEqual([0, 255, 0])
    expect(hex2rgb('00f')).toEqual([0, 0, 255])
    expect(hex2rgb('abc')).toEqual([170, 187, 204])
  })

  it('should convert 6-digit hex to RGB', () => {
    expect(hex2rgb('ffffff')).toEqual([255, 255, 255])
    expect(hex2rgb('000000')).toEqual([0, 0, 0])
    expect(hex2rgb('ff0000')).toEqual([255, 0, 0])
    expect(hex2rgb('00ff00')).toEqual([0, 255, 0])
    expect(hex2rgb('0000ff')).toEqual([0, 0, 255])
    expect(hex2rgb('aabbcc')).toEqual([170, 187, 204])
    expect(hex2rgb('123456')).toEqual([18, 52, 86])
  })

  it('should return [0, 0, 0] for invalid hex length', () => {
    expect(hex2rgb('')).toEqual([0, 0, 0])
    expect(hex2rgb('f')).toEqual([0, 0, 0])
    expect(hex2rgb('ff')).toEqual([0, 0, 0])
    expect(hex2rgb('ffff')).toEqual([0, 0, 0])
    expect(hex2rgb('fffff')).toEqual([0, 0, 0])
    expect(hex2rgb('fffffff')).toEqual([0, 0, 0])
  })
})

describe('hex2ansi256', () => {
  it('should convert hex to ANSI 256 code', () => {
    expect(hex2ansi256('ffffff')).toBe(231)
    expect(hex2ansi256('000000')).toBe(16)
    expect(hex2ansi256('808080')).toBe(244)
  })
})

describe('hex2ansi', () => {
  it('should convert hex to ANSI code', () => {
    expect(hex2ansi('ff0000')).toBe(91)
    expect(hex2ansi('00ff00')).toBe(92)
    expect(hex2ansi('0000ff')).toBe(94)
  })
})

describe('rgb2ansi256', () => {
  it('should convert grayscale RGB to ANSI 256', () => {
    expect(rgb2ansi256(0, 0, 0)).toBe(16)
    expect(rgb2ansi256(7, 7, 7)).toBe(16)
    expect(rgb2ansi256(255, 255, 255)).toBe(231)
    expect(rgb2ansi256(249, 249, 249)).toBe(231)
    expect(rgb2ansi256(128, 128, 128)).toBe(244)
    expect(rgb2ansi256(8, 8, 8)).toBe(232)
    expect(rgb2ansi256(248, 248, 248)).toBe(255)
  })

  it('should convert color RGB to ANSI 256', () => {
    expect(rgb2ansi256(255, 0, 0)).toBe(196)
    expect(rgb2ansi256(0, 255, 0)).toBe(46)
    expect(rgb2ansi256(0, 0, 255)).toBe(21)
    expect(rgb2ansi256(255, 255, 0)).toBe(226)
    expect(rgb2ansi256(255, 0, 255)).toBe(201)
    expect(rgb2ansi256(0, 255, 255)).toBe(51)
  })
})

describe('rgb2ansi', () => {
  it('should convert RGB to ANSI code', () => {
    expect(rgb2ansi(255, 0, 0)).toBe(91)
    expect(rgb2ansi(0, 255, 0)).toBe(92)
    expect(rgb2ansi(0, 0, 255)).toBe(94)
    expect(rgb2ansi(0, 0, 0)).toBe(30)
    expect(rgb2ansi(255, 255, 255)).toBe(97)
  })
})

describe('rgb2hex', () => {
  it('should convert RGB to hex string', () => {
    expect(rgb2hex(255, 255, 255)).toBe('ffffff')
    expect(rgb2hex(0, 0, 0)).toBe('000000')
    expect(rgb2hex(255, 0, 0)).toBe('ff0000')
    expect(rgb2hex(0, 255, 0)).toBe('00ff00')
    expect(rgb2hex(0, 0, 255)).toBe('0000ff')
    expect(rgb2hex(170, 187, 204)).toBe('aabbcc')
  })

  it('should pad single-digit hex values with zero', () => {
    expect(rgb2hex(0, 0, 0)).toBe('000000')
    expect(rgb2hex(15, 15, 15)).toBe('0f0f0f')
    expect(rgb2hex(1, 2, 3)).toBe('010203')
  })
})

describe('Chalk', () => {
  describe('create', () => {
    it('should throw error for invalid level', () => {
      expect(() => Chalk.create(-1 as ColorSupportLevelEnum)).toThrow()
      expect(() => Chalk.create(4 as ColorSupportLevelEnum)).toThrow()
      expect(() => Chalk.create(0.5 as ColorSupportLevelEnum)).toThrow()
      expect(() => Chalk.create(NaN as ColorSupportLevelEnum)).toThrow()
    })

    it('should return same instance for same level', () => {
      const chalk1 = Chalk.create(ColorSupportLevelEnum.BASIC)
      const chalk2 = Chalk.create(ColorSupportLevelEnum.BASIC)
      expect(chalk1).toBe(chalk2)
    })

    it('should return different instances for different levels', () => {
      const disabled = Chalk.create(ColorSupportLevelEnum.DISABLED)
      const basic = Chalk.create(ColorSupportLevelEnum.BASIC)
      const ansi256 = Chalk.create(ColorSupportLevelEnum.ANSI256)
      const true16m = Chalk.create(ColorSupportLevelEnum.True16m)
      expect(disabled).not.toBe(basic)
      expect(basic).not.toBe(ansi256)
      expect(ansi256).not.toBe(true16m)
    })
  })

  describe('color support levels', () => {
    it('should not output colors when DISABLED', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.DISABLED)
      expect(chalk.red('foo')).toBe('foo')
      expect(chalk.bold('bar')).toBe('bar')
      expect(chalk.bgBlue('baz')).toBe('baz')
    })

    it('should output ANSI codes when BASIC', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)
      expect(chalk.green('hello')).toBe('\u001B[32mhello\u001B[39m')
      expect(chalk.bold('world')).toBe('\u001B[1mworld\u001B[22m')
    })

    it('should output ANSI 256 codes when ANSI256', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.ANSI256)
      expect(chalk.ansi256(196)('red')).toBe('\u001B[38;5;196mred\u001B[39m')
    })

    it('should output true color codes when True16m', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.True16m)
      expect(chalk.rgb(255, 0, 0)('red')).toBe('\u001B[38;2;255;0;0mred\u001B[39m')
    })
  })

  describe('foreground colors', () => {
    const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)

    it('should support all basic colors', () => {
      expect(chalk.black('text')).toBe('\u001B[30mtext\u001B[39m')
      expect(chalk.red('text')).toBe('\u001B[31mtext\u001B[39m')
      expect(chalk.green('text')).toBe('\u001B[32mtext\u001B[39m')
      expect(chalk.yellow('text')).toBe('\u001B[33mtext\u001B[39m')
      expect(chalk.blue('text')).toBe('\u001B[34mtext\u001B[39m')
      expect(chalk.magenta('text')).toBe('\u001B[35mtext\u001B[39m')
      expect(chalk.cyan('text')).toBe('\u001B[36mtext\u001B[39m')
      expect(chalk.white('text')).toBe('\u001B[37mtext\u001B[39m')
    })

    it('should support bright colors', () => {
      expect(chalk.blackBright('text')).toBe('\u001B[90mtext\u001B[39m')
      expect(chalk.redBright('text')).toBe('\u001B[91mtext\u001B[39m')
      expect(chalk.greenBright('text')).toBe('\u001B[92mtext\u001B[39m')
      expect(chalk.yellowBright('text')).toBe('\u001B[93mtext\u001B[39m')
      expect(chalk.blueBright('text')).toBe('\u001B[94mtext\u001B[39m')
      expect(chalk.magentaBright('text')).toBe('\u001B[95mtext\u001B[39m')
      expect(chalk.cyanBright('text')).toBe('\u001B[96mtext\u001B[39m')
      expect(chalk.whiteBright('text')).toBe('\u001B[97mtext\u001B[39m')
    })

    it('should support gray/grey aliases', () => {
      expect(chalk.gray('text')).toBe('\u001B[90mtext\u001B[39m')
      expect(chalk.grey('text')).toBe('\u001B[90mtext\u001B[39m')
    })
  })

  describe('background colors', () => {
    const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)

    it('should support all basic background colors', () => {
      expect(chalk.bgBlack('text')).toBe('\u001B[40mtext\u001B[49m')
      expect(chalk.bgRed('text')).toBe('\u001B[41mtext\u001B[49m')
      expect(chalk.bgGreen('text')).toBe('\u001B[42mtext\u001B[49m')
      expect(chalk.bgYellow('text')).toBe('\u001B[43mtext\u001B[49m')
      expect(chalk.bgBlue('text')).toBe('\u001B[44mtext\u001B[49m')
      expect(chalk.bgMagenta('text')).toBe('\u001B[45mtext\u001B[49m')
      expect(chalk.bgCyan('text')).toBe('\u001B[46mtext\u001B[49m')
      expect(chalk.bgWhite('text')).toBe('\u001B[47mtext\u001B[49m')
    })

    it('should support bright background colors', () => {
      expect(chalk.bgBlackBright('text')).toBe('\u001B[100mtext\u001B[49m')
      expect(chalk.bgRedBright('text')).toBe('\u001B[101mtext\u001B[49m')
      expect(chalk.bgGreenBright('text')).toBe('\u001B[102mtext\u001B[49m')
      expect(chalk.bgYellowBright('text')).toBe('\u001B[103mtext\u001B[49m')
      expect(chalk.bgBlueBright('text')).toBe('\u001B[104mtext\u001B[49m')
      expect(chalk.bgMagentaBright('text')).toBe('\u001B[105mtext\u001B[49m')
      expect(chalk.bgCyanBright('text')).toBe('\u001B[106mtext\u001B[49m')
      expect(chalk.bgWhiteBright('text')).toBe('\u001B[107mtext\u001B[49m')
    })

    it('should support gray/grey background aliases', () => {
      expect(chalk.bgGray('text')).toBe('\u001B[100mtext\u001B[49m')
      expect(chalk.bgGrey('text')).toBe('\u001B[100mtext\u001B[49m')
    })
  })

  describe('modifiers', () => {
    const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)

    it('should support all modifiers', () => {
      expect(chalk.reset('text')).toBe('\u001B[0mtext\u001B[0m')
      expect(chalk.bold('text')).toBe('\u001B[1mtext\u001B[22m')
      expect(chalk.dim('text')).toBe('\u001B[2mtext\u001B[22m')
      expect(chalk.italic('text')).toBe('\u001B[3mtext\u001B[23m')
      expect(chalk.underline('text')).toBe('\u001B[4mtext\u001B[24m')
      expect(chalk.overline('text')).toBe('\u001B[53mtext\u001B[55m')
      expect(chalk.inverse('text')).toBe('\u001B[7mtext\u001B[27m')
      expect(chalk.hidden('text')).toBe('\u001B[8mtext\u001B[28m')
      expect(chalk.strikethrough('text')).toBe('\u001B[9mtext\u001B[29m')
    })
  })

  describe('chaining', () => {
    const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)

    it('should support chaining styles', () => {
      expect(chalk.red.bold('text')).toBe('\u001B[31m\u001B[1mtext\u001B[39m\u001B[39m')
      expect(chalk.bold.red('text')).toBe('\u001B[1m\u001B[31mtext\u001B[22m\u001B[22m')
    })

    it('should support multiple chained styles', () => {
      expect(chalk.red.bold.underline('text')).toBe(
        '\u001B[31m\u001B[1m\u001B[4mtext\u001B[22m\u001B[39m\u001B[39m',
      )
    })

    it('should support chaining foreground and background', () => {
      expect(chalk.red.bgBlue('text')).toBe('\u001B[31m\u001B[44mtext\u001B[39m\u001B[39m')
    })
  })

  describe('rgb/hex/ansi256 methods', () => {
    describe('with BASIC level', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)

      it('should downgrade rgb to basic ANSI', () => {
        expect(chalk.rgb(255, 0, 0)('red')).toMatch(/^\u001B\[\d+mred\u001B\[39m$/)
      })

      it('should downgrade hex to basic ANSI', () => {
        expect(chalk.hex('ff0000')('red')).toMatch(/^\u001B\[\d+mred\u001B\[39m$/)
        expect(chalk.hex('f00')('red')).toMatch(/^\u001B\[\d+mred\u001B\[39m$/)
      })
    })

    describe('with ANSI256 level', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.ANSI256)

      it('should output ANSI 256 codes for rgb', () => {
        expect(chalk.rgb(255, 0, 0)('red')).toBe('\u001B[38;5;196mred\u001B[39m')
      })

      it('should output ANSI 256 codes for hex', () => {
        expect(chalk.hex('ff0000')('red')).toBe('\u001B[38;5;196mred\u001B[39m')
      })

      it('should output ANSI 256 codes for ansi256', () => {
        expect(chalk.ansi256(196)('red')).toBe('\u001B[38;5;196mred\u001B[39m')
      })
    })

    describe('with True16m level', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.True16m)

      it('should output true color codes for rgb', () => {
        expect(chalk.rgb(255, 0, 0)('red')).toBe('\u001B[38;2;255;0;0mred\u001B[39m')
        expect(chalk.rgb(0, 255, 0)('green')).toBe('\u001B[38;2;0;255;0mgreen\u001B[39m')
        expect(chalk.rgb(0, 0, 255)('blue')).toBe('\u001B[38;2;0;0;255mblue\u001B[39m')
      })

      it('should output true color codes for hex', () => {
        expect(chalk.hex('ff0000')('red')).toBe('\u001B[38;2;255;0;0mred\u001B[39m')
        expect(chalk.hex('00ff00')('green')).toBe('\u001B[38;2;0;255;0mgreen\u001B[39m')
        expect(chalk.hex('0000ff')('blue')).toBe('\u001B[38;2;0;0;255mblue\u001B[39m')
      })

      it('should output ANSI 256 codes for ansi256 even in True16m mode', () => {
        expect(chalk.ansi256(196)('red')).toBe('\u001B[38;5;196mred\u001B[39m')
      })
    })
  })

  describe('background rgb/hex/ansi256 methods', () => {
    describe('with ANSI256 level', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.ANSI256)

      it('should output background ANSI 256 codes', () => {
        expect(chalk.bgRgb(255, 0, 0)('red')).toBe('\u001B[48;5;196mred\u001B[49m')
        expect(chalk.bgHex('ff0000')('red')).toBe('\u001B[48;5;196mred\u001B[49m')
        expect(chalk.bgAnsi256(196)('red')).toBe('\u001B[48;5;196mred\u001B[49m')
      })
    })

    describe('with True16m level', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.True16m)

      it('should output background true color codes', () => {
        expect(chalk.bgRgb(255, 0, 0)('red')).toBe('\u001B[48;2;255;0;0mred\u001B[49m')
        expect(chalk.bgHex('ff0000')('red')).toBe('\u001B[48;2;255;0;0mred\u001B[49m')
      })

      it('should output background ANSI 256 codes for bgAnsi256', () => {
        expect(chalk.bgAnsi256(196)('red')).toBe('\u001B[48;5;196mred\u001B[49m')
      })
    })
  })

  describe('edge cases', () => {
    const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)

    it('should handle empty strings', () => {
      expect(chalk.red('')).toBe('')
    })

    it('should handle multiple arguments', () => {
      expect(chalk.red('hello', 'world')).toBe('\u001B[31mhello world\u001B[39m')
    })

    it('should handle text with newlines (LF)', () => {
      const result = chalk.red('hello\nworld')
      expect(result).toBe('\u001B[31mhello\u001B[39m\n\u001B[31mworld\u001B[39m')
    })

    it('should handle text with CRLF', () => {
      const result = chalk.red('hello\r\nworld')
      expect(result).toBe('\u001B[31mhello\u001B[39m\r\n\u001B[31mworld\u001B[39m')
    })

    it('should handle text with mixed LF and CRLF', () => {
      const result = chalk.red('a\nb\r\nc')
      expect(result).toBe('\u001B[31ma\u001B[39m\n\u001B[31mb\u001B[39m\r\n\u001B[31mc\u001B[39m')
    })

    it('should handle text containing ANSI escape codes', () => {
      const inner = '\u001B[32mgreen\u001B[39m'
      const result = chalk.red(`hello ${inner} world`)
      expect(result).toBe('\u001B[31mhello \u001B[32mgreen\u001B[31m world\u001B[39m')
    })

    it('should handle nested styles with ANSI codes', () => {
      const chalk256 = Chalk.create(ColorSupportLevelEnum.ANSI256)
      const inner = chalk256.blue('inner')
      const result = chalk256.red(`outer ${inner} outer`)
      expect(result).toContain('\u001B[31m')
      expect(result).toContain('\u001B[34m')
    })
  })

  describe('visible getter', () => {
    it('should return empty string when level is DISABLED', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.DISABLED)
      expect(chalk.visible('text')).toBe('')
    })

    it('should return text without styling when BASIC', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)
      expect(chalk.visible('text')).toBe('text')
    })
  })

  describe('level and styler properties', () => {
    it('should expose level property', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)
      expect(chalk.level).toBe(ColorSupportLevelEnum.BASIC)
    })

    it('should expose styler property as undefined for base chalk', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)
      expect(chalk.styler).toBeUndefined()
    })

    it('should have styler defined after applying style', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)
      expect(chalk.red.styler).toBeDefined()
    })

    it('should expose isEmpty property', () => {
      const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)
      expect(chalk.isEmpty).toBe(false)
    })
  })
})
