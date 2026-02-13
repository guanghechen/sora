import { logColorfulOption, logDateOption, logLevelOption, silentOption } from '../src'

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

    it('should call reporter.setLevel("error") when true', () => {
      const mockReporter = {
        setLevel: vi.fn(),
        setFlight: vi.fn(),
      }
      const ctx = { reporter: mockReporter } as any
      silentOption.apply!(true, ctx)
      expect(mockReporter.setLevel).toHaveBeenCalledWith('error')
    })
  })

  describe('logDateOption', () => {
    it('should have correct properties', () => {
      expect(logDateOption.long).toBe('logDate')
      expect(logDateOption.short).toBeUndefined()
      expect(logDateOption.type).toBe('boolean')
      expect(logDateOption.args).toBe('none')
      expect(logDateOption.default).toBe(true)
    })

    it('should call reporter.setFlight in apply', () => {
      const mockReporter = {
        setLevel: vi.fn(),
        setFlight: vi.fn(),
      }
      const ctx = { reporter: mockReporter } as any
      logDateOption.apply!(false, ctx)
      expect(mockReporter.setFlight).toHaveBeenCalledWith({ date: false })
    })
  })

  describe('logColorfulOption', () => {
    it('should have correct properties', () => {
      expect(logColorfulOption.long).toBe('logColorful')
      expect(logColorfulOption.short).toBeUndefined()
      expect(logColorfulOption.type).toBe('boolean')
      expect(logColorfulOption.args).toBe('none')
      expect(logColorfulOption.default).toBe(true)
    })

    it('should call reporter.setFlight in apply', () => {
      const mockReporter = {
        setLevel: vi.fn(),
        setFlight: vi.fn(),
      }
      const ctx = { reporter: mockReporter } as any
      logColorfulOption.apply!(false, ctx)
      expect(mockReporter.setFlight).toHaveBeenCalledWith({ color: false })
    })
  })
})
