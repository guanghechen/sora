import { vi } from 'vitest'
import type { IReporterLevel, IReporterOutput } from '../src'
import { Reporter } from '../src'

describe('Reporter', () => {
  describe('constructor', () => {
    it('should create with default options', () => {
      const reporter = new Reporter()
      expect(reporter).toBeInstanceOf(Reporter)
    })

    it('should accept prefix', () => {
      const reporter = new Reporter({ prefix: 'app' })
      reporter.mock()
      reporter.info('test')
      const entries = reporter.collect()
      expect(entries[0].prefixes).toEqual(['app'])
    })

    it('should throw if prefix contains colon', () => {
      expect(() => new Reporter({ prefix: 'app:sub' })).toThrow('Prefix cannot contain ":"')
    })

    it('should accept level option', () => {
      const reporter = new Reporter({ level: 'warn' })
      reporter.mock()
      reporter.debug('should not appear')
      reporter.info('should not appear')
      reporter.warn('should appear')
      const entries = reporter.collect()
      expect(entries).toHaveLength(1)
      expect(entries[0].level).toBe('warn')
    })

    it('should fallback to info for invalid level', () => {
      const reporter = new Reporter({ level: 'invalid' as IReporterLevel })
      reporter.mock()
      reporter.debug('should not appear')
      reporter.info('should appear')
      const entries = reporter.collect()
      expect(entries).toHaveLength(1)
      expect(entries[0].level).toBe('info')
    })

    it('should accept custom output function', () => {
      const output = vi.fn<IReporterOutput>()
      const reporter = new Reporter({ output })
      reporter.info('test message')
      expect(output).toHaveBeenCalledWith('info', expect.any(Array), ['test message'])
    })

    it('should accept flight options', () => {
      const output = vi.fn<IReporterOutput>()
      const reporter = new Reporter({ flight: { date: false, color: false }, output })
      reporter.info('test')
      expect(output).toHaveBeenCalled()
      const parts = output.mock.calls[0][1]
      expect(parts).toHaveLength(1)
      expect(parts[0]).toBe('[info]')
    })
  })

  describe('attach', () => {
    it('should push prefix and return detach function', () => {
      const reporter = new Reporter({ prefix: 'app' })
      reporter.mock()
      const detach = reporter.attach('module')
      reporter.info('with module')
      detach()
      reporter.info('without module')
      const entries = reporter.collect()
      expect(entries[0].prefixes).toEqual(['app', 'module'])
      expect(entries[1].prefixes).toEqual(['app'])
    })

    it('should throw if prefix contains colon', () => {
      const reporter = new Reporter()
      expect(() => reporter.attach('mod:sub')).toThrow('Prefix cannot contain ":"')
    })

    it('should support nested attach/detach', () => {
      const reporter = new Reporter({ prefix: 'root' })
      reporter.mock()
      const detach1 = reporter.attach('level1')
      const detach2 = reporter.attach('level2')
      reporter.info('nested')
      detach2()
      reporter.info('level1 only')
      detach1()
      reporter.info('root only')
      const entries = reporter.collect()
      expect(entries[0].prefixes).toEqual(['root', 'level1', 'level2'])
      expect(entries[1].prefixes).toEqual(['root', 'level1'])
      expect(entries[2].prefixes).toEqual(['root'])
    })
  })

  describe('mock/collect', () => {
    it('should capture log entries in mock mode', () => {
      const reporter = new Reporter({ prefix: 'test', level: 'debug' })
      reporter.mock()
      reporter.debug('debug msg')
      reporter.info('info msg')
      reporter.warn('warn msg')
      reporter.error('error msg')
      const entries = reporter.collect()
      expect(entries).toHaveLength(4)
      expect(entries.map(e => e.level)).toEqual(['debug', 'info', 'warn', 'error'])
      expect(entries.map(e => e.args)).toEqual([
        ['debug msg'],
        ['info msg'],
        ['warn msg'],
        ['error msg'],
      ])
    })

    it('should clear entries after collect', () => {
      const reporter = new Reporter()
      reporter.mock()
      reporter.info('test')
      reporter.collect()
      const output = vi.fn<IReporterOutput>()
      const reporter2 = new Reporter({ output })
      reporter2.mock()
      reporter2.info('captured')
      reporter2.collect()
      reporter2.info('not captured')
      expect(output).toHaveBeenCalledTimes(1)
    })

    it('should return empty array if not in mock mode', () => {
      const reporter = new Reporter()
      const entries = reporter.collect()
      expect(entries).toEqual([])
    })

    it('mock should return this for chaining', () => {
      const reporter = new Reporter()
      expect(reporter.mock()).toBe(reporter)
    })
  })

  describe('log levels', () => {
    it('should filter by threshold', () => {
      const reporter = new Reporter({ level: 'warn' })
      reporter.mock()
      reporter.debug('no')
      reporter.info('no')
      reporter.warn('yes')
      reporter.error('yes')
      const entries = reporter.collect()
      expect(entries).toHaveLength(2)
    })

    it.each<[IReporterLevel, number]>([
      ['debug', 4],
      ['info', 3],
      ['warn', 2],
      ['error', 1],
    ])('level %s should allow %d levels', (level, expectedCount) => {
      const reporter = new Reporter({ level })
      reporter.mock()
      reporter.debug('d')
      reporter.info('i')
      reporter.warn('w')
      reporter.error('e')
      const entries = reporter.collect()
      expect(entries).toHaveLength(expectedCount)
    })
  })

  describe('lazy evaluation', () => {
    it('should call function arguments lazily', () => {
      const reporter = new Reporter({ level: 'info' })
      reporter.mock()
      const expensive = vi.fn(() => 'computed')
      reporter.info(expensive)
      const entries = reporter.collect()
      expect(expensive).toHaveBeenCalledTimes(1)
      expect(entries[0].args).toEqual(['computed'])
    })

    it('should not call function if level is filtered', () => {
      const reporter = new Reporter({ level: 'error' })
      reporter.mock()
      const expensive = vi.fn(() => 'computed')
      reporter.debug(expensive)
      reporter.collect()
      expect(expensive).not.toHaveBeenCalled()
    })
  })

  describe('chaining', () => {
    it('debug/info/warn/error should return this', () => {
      const reporter = new Reporter({ level: 'debug' })
      reporter.mock()
      expect(reporter.debug('a').info('b').warn('c').error('d')).toBe(reporter)
      const entries = reporter.collect()
      expect(entries).toHaveLength(4)
    })
  })

  describe('output formatting', () => {
    it('should include timestamp when date is true', () => {
      const output = vi.fn<IReporterOutput>()
      const reporter = new Reporter({ flight: { date: true, color: false }, output })
      reporter.info('test')
      const parts = output.mock.calls[0][1]
      expect(parts).toHaveLength(2)
      expect(parts[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should not include timestamp when date is false', () => {
      const output = vi.fn<IReporterOutput>()
      const reporter = new Reporter({ flight: { date: false, color: false }, output })
      reporter.info('test')
      const parts = output.mock.calls[0][1]
      expect(parts).toHaveLength(1)
    })

    it('should use level as tag when no prefix', () => {
      const output = vi.fn<IReporterOutput>()
      const reporter = new Reporter({ flight: { date: false, color: false }, output })
      reporter.warn('test')
      const parts = output.mock.calls[0][1]
      expect(parts[0]).toBe('[warn]')
    })

    it('should use prefix as tag when present', () => {
      const output = vi.fn<IReporterOutput>()
      const reporter = new Reporter({
        prefix: 'myapp',
        flight: { date: false, color: false },
        output,
      })
      reporter.info('test')
      const parts = output.mock.calls[0][1]
      expect(parts[0]).toBe('[myapp]')
    })

    it('should join multiple prefixes with colon', () => {
      const output = vi.fn<IReporterOutput>()
      const reporter = new Reporter({
        prefix: 'app',
        flight: { date: false, color: false },
        output,
      })
      reporter.attach('module')
      reporter.info('test')
      const parts = output.mock.calls[0][1]
      expect(parts[0]).toBe('[app:module]')
    })
  })

  describe('entry date', () => {
    it('should capture date in mock mode', () => {
      const reporter = new Reporter()
      reporter.mock()
      const before = new Date()
      reporter.info('test')
      const after = new Date()
      const entries = reporter.collect()
      expect(entries[0].date.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(entries[0].date.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })
})
