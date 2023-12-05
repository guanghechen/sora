// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { chalk } from '@guanghechen/chalk/node'
import { Reporter, ReporterLevelEnum } from '../src'

describe('Reporter', () => {
  describe('options', () => {
    test('flights', () => {
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
  })

  test('setDivisionName', () => {
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

  test('setLevel', () => {
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
})
