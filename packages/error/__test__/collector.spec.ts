import type { ISoraErrorCollector } from '../src'
import { SoraErrorCollector, SoraErrorLevel } from '../src'

describe('SoraErrorCollector', () => {
  let collector: ISoraErrorCollector

  beforeEach(() => {
    collector = new SoraErrorCollector('TestCollector')
  })

  afterEach(() => {
    collector.cleanup()
  })

  it('should initialize with the correct name', () => {
    expect(collector.name).toBe('TestCollector')
  })

  it('should add errors correctly', () => {
    collector.add('Source1', 'Error1', SoraErrorLevel.FATAL)
    collector.add('Source2', 'Error2', SoraErrorLevel.WARN)

    expect(collector.size).toBe(2)
    expect(collector.errors).toEqual([
      { from: 'Source1', level: SoraErrorLevel.FATAL, details: 'Error1' },
      { from: 'Source2', level: SoraErrorLevel.WARN, details: 'Error2' },
    ])
  })

  it('should merge errors from another collector', () => {
    collector.add('Source1', 'Error1')
    expect(collector.size).toBe(1)
    expect(collector.errors).toEqual([
      { from: 'Source1', level: SoraErrorLevel.ERROR, details: 'Error1' },
    ])

    const otherCollector = new SoraErrorCollector('OtherCollector')
    otherCollector.add('Source3', 'Error3', SoraErrorLevel.WARN)

    collector.merge(otherCollector)

    expect(collector.size).toBe(2)
    expect(collector.errors).toEqual([
      { from: 'Source1', level: SoraErrorLevel.ERROR, details: 'Error1' },
      { from: 'Source3', level: SoraErrorLevel.WARN, details: 'Error3' },
    ])
  })

  it('should cleanup errors', () => {
    collector.add('Source4', 'Error4')
    collector.add('Source5', 'Error5')
    expect(collector.size).toBe(2)
    expect(collector.errors).toEqual([
      { from: 'Source4', level: SoraErrorLevel.ERROR, details: 'Error4' },
      { from: 'Source5', level: SoraErrorLevel.ERROR, details: 'Error5' },
    ])

    collector.cleanup()

    expect(collector.size).toBe(0)
    expect(collector.errors).toEqual([])

    collector.add('Source6', 'Error6')
    expect(collector.size).toBe(1)
    expect(collector.errors).toEqual([
      { from: 'Source6', level: SoraErrorLevel.ERROR, details: 'Error6' },
    ])
  })
})
