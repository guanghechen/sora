import { describe, expect, it } from 'vitest'
import { ColorSupportLevelEnum } from '../src'

describe('supports-color (node)', () => {
  it('should export supportsColor and supportsColorStderr', async () => {
    const { supportsColor, supportsColorStderr } = await import('../src/node')
    expect(supportsColor === false || typeof supportsColor === 'object').toBe(true)
    expect(supportsColorStderr === false || typeof supportsColorStderr === 'object').toBe(true)
  })

  it('should export chalk and chalkStderr instances', async () => {
    const { chalk, chalkStderr } = await import('../src/node')
    expect(typeof chalk.red).toBe('function')
    expect(typeof chalkStderr.red).toBe('function')
  })

  it('should have chalk instances work correctly', async () => {
    const { chalk } = await import('../src/node')
    const result = chalk.red('test')
    expect(typeof result).toBe('string')
  })

  describe('color support object structure', () => {
    it('should have correct structure when colors are supported', async () => {
      const { supportsColor } = await import('../src/node')
      if (supportsColor !== false) {
        expect(supportsColor).toHaveProperty('level')
        expect(supportsColor).toHaveProperty('hasBasic')
        expect(supportsColor).toHaveProperty('has256')
        expect(supportsColor).toHaveProperty('has16m')
        expect(typeof supportsColor.level).toBe('number')
        expect(typeof supportsColor.hasBasic).toBe('boolean')
        expect(typeof supportsColor.has256).toBe('boolean')
        expect(typeof supportsColor.has16m).toBe('boolean')
      }
    })

    it('should have consistent has256 and has16m based on level', async () => {
      const { supportsColor } = await import('../src/node')
      if (supportsColor !== false) {
        if (supportsColor.level >= ColorSupportLevelEnum.ANSI256) {
          expect(supportsColor.has256).toBe(true)
        }
        if (supportsColor.level >= ColorSupportLevelEnum.True16m) {
          expect(supportsColor.has16m).toBe(true)
        }
        expect(supportsColor.hasBasic).toBe(true)
      }
    })
  })
})

describe('supports-color (browser)', () => {
  it('should export supportsColor and supportsColorStderr', async () => {
    const { supportsColor, supportsColorStderr } = await import('../src/browser/supports-color')
    expect(supportsColor === false || typeof supportsColor === 'object').toBe(true)
    expect(supportsColorStderr === false || typeof supportsColorStderr === 'object').toBe(true)
  })

  it('should export chalk and chalkStderr instances', async () => {
    const { chalk, chalkStderr } = await import('../src/browser')
    expect(typeof chalk.red).toBe('function')
    expect(typeof chalkStderr.red).toBe('function')
  })

  it('should have chalk instances work correctly', async () => {
    const { chalk } = await import('../src/browser')
    const result = chalk.red('test')
    expect(typeof result).toBe('string')
  })

  describe('browser detection', () => {
    it('should return DISABLED when not in browser environment', async () => {
      const { supportsColor } = await import('../src/browser/supports-color')
      expect(supportsColor).toBe(false)
    })
  })
})
