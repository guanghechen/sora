// @ts-ignore
import { chalk } from '@guanghechen/chalk/node'
import { Reporter, ReporterLevelEnum } from '../src'

describe('Reporter', () => {
  describe('options', () => {
    it('flights', () => {
      const reporter = new Reporter(chalk, {
        flights: { colorful: false },
      })
      expect(reporter.flights).toEqual({
        date: false,
        title: true,
        inline: true,
        colorful: false,
      })
    })

    it('should use default flights when not specified', () => {
      const reporter = new Reporter(chalk)
      expect(reporter.flights).toEqual({
        date: false,
        title: true,
        inline: true,
        colorful: true,
      })
    })

    it('should set baseName', () => {
      const reporter = new Reporter(chalk, { baseName: 'test-app' })
      expect(reporter.name).toBe('test-app')
    })

    it('should set custom placeholderRegex', () => {
      const reporter = new Reporter(chalk, {
        placeholderRegex: /\$\{(\d+)\}/g,
        flights: { colorful: false, title: false },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)
      const result = reporter.format(ReporterLevelEnum.DEBUG, 'Value: ${0}', ['hello'])
      expect(result).toContain('Value: hello')
    })

    it('should parse args from command line', () => {
      const reporter = new Reporter(chalk, {}, ['--log-level=debug', '--log-basename=cli-app'])
      expect(reporter.level).toBe(ReporterLevelEnum.DEBUG)
      expect(reporter.name).toBe('cli-app')
    })

    it('should merge options from args with provided options', () => {
      const reporter = new Reporter(chalk, { baseName: 'original', flights: { date: true } }, [
        '--log-basename=from-args',
      ])
      expect(reporter.name).toBe('from-args')
      expect(reporter.flights.date).toBe(true)
    })
  })

  describe('name', () => {
    it('should return empty string when both baseName and divisionName are empty', () => {
      const reporter = new Reporter(chalk, {})
      expect(reporter.name).toBe('')
    })

    it('should return divisionName when baseName is empty', () => {
      const reporter = new Reporter(chalk, {})
      reporter.setDivisionName('division')
      expect(reporter.name).toBe('division')
    })
  })

  it('setDivisionName', () => {
    const reporter = new Reporter(chalk, {
      baseName: 'basename',
    })
    expect(reporter.name).toBe('basename')

    reporter.setDivisionName('name')
    expect(reporter.name).toBe('basename#name')

    reporter.setDivisionName('new name')
    expect(reporter.name).toBe('basename#new name')

    reporter.setDivisionName('')
    expect(reporter.name).toBe('basename')
  })

  it('setLevel', () => {
    const logger = new Reporter(chalk)
    expect(logger.level).toBe(ReporterLevelEnum.INFO)

    for (const level of [
      ReporterLevelEnum.DEBUG,
      ReporterLevelEnum.VERBOSE,
      ReporterLevelEnum.INFO,
      ReporterLevelEnum.WARN,
      ReporterLevelEnum.ERROR,
      ReporterLevelEnum.FATAL,
    ]) {
      logger.setLevel(level)
      expect(logger.level).toBe(level)

      logger.setLevel(null)
      expect(logger.level).toBe(level)

      logger.setLevel(undefined)
      expect(logger.level).toBe(level)
    }
  })

  describe('write', () => {
    it('should write text to stdout', () => {
      const reporter = new Reporter(chalk)
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      reporter.write('test message')

      expect(writeSpy).toHaveBeenCalledWith('test message')
      writeSpy.mockRestore()
    })
  })

  describe('log methods', () => {
    let reporter: Reporter
    let writeSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      reporter = new Reporter(chalk, {
        baseName: 'test',
        flights: { colorful: false, title: true },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)
      writeSpy = vi.spyOn(reporter, 'write').mockImplementation(() => {})
    })

    afterEach(() => {
      writeSpy.mockRestore()
    })

    it('debug should call log with DEBUG level', () => {
      reporter.debug('debug message')
      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls[0][0]
      expect(output).toContain('debug')
      expect(output).toContain('debug message')
    })

    it('verbose should call log with VERBOSE level', () => {
      reporter.verbose('verbose message')
      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls[0][0]
      expect(output).toContain('verb')
      expect(output).toContain('verbose message')
    })

    it('info should call log with INFO level', () => {
      reporter.info('info message')
      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls[0][0]
      expect(output).toContain('info')
      expect(output).toContain('info message')
    })

    it('warn should call log with WARN level', () => {
      reporter.warn('warn message')
      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls[0][0]
      expect(output).toContain('warn')
      expect(output).toContain('warn message')
    })

    it('error should call log with ERROR level', () => {
      reporter.error('error message')
      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls[0][0]
      expect(output).toContain('error')
      expect(output).toContain('error message')
    })

    it('fatal should call log with FATAL level', () => {
      reporter.fatal('fatal message')
      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls[0][0]
      expect(output).toContain('fatal')
      expect(output).toContain('fatal message')
    })

    it('should not log when level is lower than reporter level', () => {
      reporter.setLevel(ReporterLevelEnum.ERROR)
      reporter.debug('should not appear')
      reporter.verbose('should not appear')
      reporter.info('should not appear')
      reporter.warn('should not appear')
      expect(writeSpy).not.toHaveBeenCalled()
    })
  })

  describe('log', () => {
    it('should not write when format returns undefined', () => {
      const reporter = new Reporter(chalk, { flights: { colorful: false } })
      reporter.setLevel(ReporterLevelEnum.ERROR)
      const writeSpy = vi.spyOn(reporter, 'write').mockImplementation(() => {})

      reporter.log(ReporterLevelEnum.DEBUG, 'test', [])

      expect(writeSpy).not.toHaveBeenCalled()
      writeSpy.mockRestore()
    })
  })

  describe('format', () => {
    let reporter: Reporter

    beforeEach(() => {
      reporter = new Reporter(chalk, {
        baseName: 'test',
        flights: { colorful: false, title: true },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)
    })

    it('should return undefined when level is 0', () => {
      const result = reporter.format(0 as ReporterLevelEnum, 'test', [])
      expect(result).toBeUndefined()
    })

    it('should return undefined when level is lower than reporter level', () => {
      reporter.setLevel(ReporterLevelEnum.ERROR)
      const result = reporter.format(ReporterLevelEnum.DEBUG, 'test', [])
      expect(result).toBeUndefined()
    })

    it('should format message with placeholders', () => {
      const result = reporter.format(ReporterLevelEnum.INFO, 'Hello {} world {}', [
        'beautiful',
        '!',
      ])
      expect(result).toContain('Hello beautiful world !')
    })

    it('should keep unmatched placeholders', () => {
      const result = reporter.format(ReporterLevelEnum.INFO, 'Hello {} world {}', ['beautiful'])
      expect(result).toContain('Hello beautiful world {}')
    })

    it('should append unpaired arguments', () => {
      const result = reporter.format(ReporterLevelEnum.INFO, 'Hello', ['arg1', 'arg2'])
      expect(result).toContain('Hello arg1 arg2')
    })

    it('should handle non-string messageFormat', () => {
      const result = reporter.format(ReporterLevelEnum.INFO, { key: 'value' }, ['extra'])
      expect(result).toContain('"key":"value"')
      expect(result).toContain('extra')
    })

    it('should handle message ending with newline', () => {
      const result = reporter.format(ReporterLevelEnum.INFO, 'test {}', ['line\n'])
      expect(result).toContain('line')
      expect(result?.endsWith('\n')).toBe(true)
    })

    it('should prepend newline when message argument ends with newline (inline=false)', () => {
      const reporterNoInline = new Reporter(chalk, {
        baseName: 'test',
        flights: { colorful: false, title: false, inline: false },
      })
      reporterNoInline.setLevel(ReporterLevelEnum.DEBUG)
      const result = reporterNoInline.format(ReporterLevelEnum.INFO, 'test {}', ['multiline\n'])
      expect(result).toContain('\nmultiline\n')
    })

    it('should add newline if message does not end with newline', () => {
      const result = reporter.format(ReporterLevelEnum.INFO, 'test message', [])
      expect(result?.endsWith('\n')).toBe(true)
    })

    it('should handle escaped placeholders', () => {
      const result = reporter.format(ReporterLevelEnum.INFO, 'Value: \\{} and {}', ['replaced'])
      expect(result).toContain('Value: \\{} and replaced')
    })
  })

  describe('formatHeader', () => {
    it('should include date when date flight is enabled', () => {
      const reporter = new Reporter(chalk, {
        baseName: 'test',
        flights: { colorful: false, title: true, date: true },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)

      const result = reporter.format(ReporterLevelEnum.INFO, 'test', [])
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
    })

    it('should not include date when date flight is disabled', () => {
      const reporter = new Reporter(chalk, {
        baseName: 'test',
        flights: { colorful: false, title: true, date: false },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)

      const result = reporter.format(ReporterLevelEnum.INFO, 'test', [])
      expect(result).not.toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
    })

    it('should include title when title flight is enabled', () => {
      const reporter = new Reporter(chalk, {
        baseName: 'myapp',
        flights: { colorful: false, title: true },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)

      const result = reporter.format(ReporterLevelEnum.INFO, 'test', [])
      expect(result).toContain('[myapp]')
    })

    it('should not include title when title flight is disabled', () => {
      const reporter = new Reporter(chalk, {
        baseName: 'myapp',
        flights: { colorful: false, title: false },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)

      const result = reporter.format(ReporterLevelEnum.INFO, 'test', [])
      expect(result).not.toContain('[myapp]')
    })

    it('should apply colors when colorful is enabled (with color support)', () => {
      const reporter = new Reporter(chalk, {
        baseName: 'test',
        flights: { colorful: true, title: true },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)

      const result = reporter.format(ReporterLevelEnum.INFO, 'test', [])
      expect(result).toBeDefined()
      expect(result).toContain('test')
    })

    it('should apply background color for FATAL level', () => {
      const reporter = new Reporter(chalk, {
        baseName: 'test',
        flights: { colorful: true, title: true },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)

      const result = reporter.format(ReporterLevelEnum.FATAL, 'fatal error', [])
      expect(result).toContain('fatal')
      expect(result).toContain('fatal error')
    })
  })

  describe('formatContent', () => {
    it('should apply content colors when colorful is enabled', () => {
      const reporter = new Reporter(chalk, {
        flights: { colorful: true, title: false },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)

      const levels = [
        ReporterLevelEnum.DEBUG,
        ReporterLevelEnum.VERBOSE,
        ReporterLevelEnum.INFO,
        ReporterLevelEnum.WARN,
        ReporterLevelEnum.ERROR,
        ReporterLevelEnum.FATAL,
      ]

      for (const level of levels) {
        const result = reporter.format(level, 'content', [])
        expect(result).toBeDefined()
        expect(result).toContain('content')
      }
    })

    it('should not apply colors when colorful is disabled', () => {
      const reporter = new Reporter(chalk, {
        flights: { colorful: false, title: false },
      })
      reporter.setLevel(ReporterLevelEnum.DEBUG)

      const result = reporter.format(ReporterLevelEnum.INFO, 'plain content', [])
      expect(result).toContain('info')
      expect(result).toContain('plain content')
    })
  })

  describe('formatSingleMessage', () => {
    it('should format string message', () => {
      const reporter = new Reporter(chalk, { flights: { inline: true } })
      const result = reporter.formatSingleMessage('hello world')
      expect(result).toBe('hello world')
    })

    it('should format object message', () => {
      const reporter = new Reporter(chalk, { flights: { inline: true } })
      const result = reporter.formatSingleMessage({ key: 'value' })
      expect(result).toBe('{"key":"value"}')
    })

    it('should format null message', () => {
      const reporter = new Reporter(chalk, { flights: { inline: true } })
      const result = reporter.formatSingleMessage(null)
      expect(result).toBe('null')
    })

    it('should format undefined message', () => {
      const reporter = new Reporter(chalk, { flights: { inline: true } })
      const result = reporter.formatSingleMessage(undefined)
      expect(result).toBe('undefined')
    })

    it('should format number message', () => {
      const reporter = new Reporter(chalk, { flights: { inline: true } })
      expect(reporter.formatSingleMessage(42)).toBe('42')
      expect(reporter.formatSingleMessage(0)).toBe('0')
      expect(reporter.formatSingleMessage(-1.5)).toBe('-1.5')
    })

    it('should format boolean message', () => {
      const reporter = new Reporter(chalk, { flights: { inline: true } })
      expect(reporter.formatSingleMessage(true)).toBe('true')
      expect(reporter.formatSingleMessage(false)).toBe('false')
    })

    it('should format empty string', () => {
      const reporter = new Reporter(chalk, { flights: { inline: true } })
      const result = reporter.formatSingleMessage('')
      expect(result).toBe('')
    })

    it('should inline multiline strings when inline is true', () => {
      const reporter = new Reporter(chalk, { flights: { inline: true } })
      const result = reporter.formatSingleMessage('line1\nline2\nline3')
      expect(result).toBe('line1 line2 line3')
    })

    it('should preserve multiline strings when inline is false', () => {
      const reporter = new Reporter(chalk, { flights: { inline: false } })
      const result = reporter.formatSingleMessage('line1\nline2\nline3')
      expect(result).toBe('line1\nline2\nline3')
    })
  })

  describe('levelStyleMap', () => {
    it('should have correct titles for all levels', () => {
      const reporter = new Reporter(chalk)
      expect(reporter.levelStyleMap[ReporterLevelEnum.DEBUG].title).toBe('debug')
      expect(reporter.levelStyleMap[ReporterLevelEnum.VERBOSE].title).toBe('verb ')
      expect(reporter.levelStyleMap[ReporterLevelEnum.INFO].title).toBe('info ')
      expect(reporter.levelStyleMap[ReporterLevelEnum.WARN].title).toBe('warn ')
      expect(reporter.levelStyleMap[ReporterLevelEnum.ERROR].title).toBe('error')
      expect(reporter.levelStyleMap[ReporterLevelEnum.FATAL].title).toBe('fatal')
    })

    it('should be frozen', () => {
      const reporter = new Reporter(chalk)
      expect(Object.isFrozen(reporter.levelStyleMap)).toBe(true)
    })
  })
})
