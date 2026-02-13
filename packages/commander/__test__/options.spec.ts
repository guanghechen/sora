import { logLevelOption, silentOption } from '../src'

describe('options', () => {
  describe('logLevelOption', () => {
    it('should have correct properties', () => {
      expect(logLevelOption.long).toBe('logLevel')
      expect(logLevelOption.short).toBeUndefined()
      expect(logLevelOption.type).toBe('string')
      expect(logLevelOption.args).toBe('required')
      expect(logLevelOption.default).toBe('info')
      expect(logLevelOption.choices).toEqual(['debug', 'info', 'hint', 'warn', 'error'])
      expect(logLevelOption.apply).toBeDefined()
    })

    it('should coerce valid input to lowercase', () => {
      expect(logLevelOption.coerce!('DEBUG')).toBe('debug')
      expect(logLevelOption.coerce!('Info')).toBe('info')
    })

    it('should throw for invalid input in coerce', () => {
      expect(() => logLevelOption.coerce!('invalid')).toThrow('Invalid log level: invalid')
    })

    it('should support spread override', () => {
      const custom = { ...logLevelOption, default: 'warn' }
      expect(custom.default).toBe('warn')
      expect(custom.long).toBe('logLevel')
    })

    it('should call reporter.setLevel in apply', () => {
      const mockReporter = {
        setLevel: vi.fn(),
        setFlight: vi.fn(),
      }
      const ctx = { reporter: mockReporter } as any
      logLevelOption.apply!('debug', ctx)
      expect(mockReporter.setLevel).toHaveBeenCalledWith('debug')
    })
  })

  describe('silentOption', () => {
    it('should have correct properties', () => {
      expect(silentOption.long).toBe('silent')
      expect(silentOption.short).toBeUndefined()
      expect(silentOption.type).toBe('boolean')
      expect(silentOption.args).toBe('none')
      expect(silentOption.default).toBe(false)
    })
  })
})
