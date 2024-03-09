import { ReporterLevelEnum, resolveLevel, retrieveLevelName } from '../src'

describe('resolveLevel', () => {
  it('debug', () => {
    expect(resolveLevel('debug')).toBe(ReporterLevelEnum.DEBUG)
    expect(resolveLevel('DEBUG')).toBe(ReporterLevelEnum.DEBUG)
    expect(resolveLevel(ReporterLevelEnum.DEBUG)).toBe(ReporterLevelEnum.DEBUG)
  })

  it('verbose', () => {
    expect(resolveLevel('verb')).toBe(ReporterLevelEnum.VERBOSE)
    expect(resolveLevel('verbose')).toBe(ReporterLevelEnum.VERBOSE)
    expect(resolveLevel('VERB')).toBe(ReporterLevelEnum.VERBOSE)
    expect(resolveLevel('VERBOSE')).toBe(ReporterLevelEnum.VERBOSE)
    expect(resolveLevel(ReporterLevelEnum.VERBOSE)).toBe(ReporterLevelEnum.VERBOSE)
  })

  it('info', () => {
    expect(resolveLevel('info')).toBe(ReporterLevelEnum.INFO)
    expect(resolveLevel('information')).toBe(ReporterLevelEnum.INFO)
    expect(resolveLevel('INFO')).toBe(ReporterLevelEnum.INFO)
    expect(resolveLevel('INFORMATION')).toBe(ReporterLevelEnum.INFO)
    expect(resolveLevel(ReporterLevelEnum.INFO)).toBe(ReporterLevelEnum.INFO)
  })

  it('warning', () => {
    expect(resolveLevel('warn')).toBe(ReporterLevelEnum.WARN)
    expect(resolveLevel('warning')).toBe(ReporterLevelEnum.WARN)
    expect(resolveLevel('WARN')).toBe(ReporterLevelEnum.WARN)
    expect(resolveLevel('WARNING')).toBe(ReporterLevelEnum.WARN)
    expect(resolveLevel(ReporterLevelEnum.WARN)).toBe(ReporterLevelEnum.WARN)
  })

  it('error', () => {
    expect(resolveLevel('error')).toBe(ReporterLevelEnum.ERROR)
    expect(resolveLevel('ERROR')).toBe(ReporterLevelEnum.ERROR)
    expect(resolveLevel(ReporterLevelEnum.ERROR)).toBe(ReporterLevelEnum.ERROR)
  })

  it('fatal', () => {
    expect(resolveLevel('fatal')).toBe(ReporterLevelEnum.FATAL)
    expect(resolveLevel('FATAL')).toBe(ReporterLevelEnum.FATAL)
    expect(resolveLevel(ReporterLevelEnum.FATAL)).toBe(ReporterLevelEnum.FATAL)
  })
})

describe('retrieveLevelName', () => {
  it('debug', () => {
    expect(retrieveLevelName(ReporterLevelEnum.DEBUG)).toBe('debug')
  })

  it('verbose', () => {
    expect(retrieveLevelName(ReporterLevelEnum.VERBOSE)).toBe('verbose')
  })

  it('info', () => {
    expect(retrieveLevelName(ReporterLevelEnum.INFO)).toBe('info')
  })

  it('warn', () => {
    expect(retrieveLevelName(ReporterLevelEnum.WARN)).toBe('warn')
  })

  it('error', () => {
    expect(retrieveLevelName(ReporterLevelEnum.ERROR)).toBe('error')
  })

  it('fatal', () => {
    expect(retrieveLevelName(ReporterLevelEnum.FATAL)).toBe('fatal')
  })
})
