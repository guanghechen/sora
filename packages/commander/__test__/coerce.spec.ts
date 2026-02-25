import { Coerce } from '../src'

describe('coerce', () => {
  describe('Coerce.number', () => {
    it('should return parsed finite number', () => {
      const coerce = Coerce.number('--scale')

      expect(coerce('0')).toBe(0)
      expect(coerce('-1.25')).toBe(-1.25)
      expect(coerce(' 3.14 ')).toBe(3.14)
    })

    it('should throw default error on invalid number input', () => {
      const coerce = Coerce.number('--scale')

      expect(() => coerce('abc')).toThrow('--scale is expected as a finite number, but got abc')
      expect(() => coerce('Infinity')).toThrow(
        '--scale is expected as a finite number, but got Infinity',
      )
      expect(() => coerce('-Infinity')).toThrow(
        '--scale is expected as a finite number, but got -Infinity',
      )
      expect(() => coerce('NaN')).toThrow('--scale is expected as a finite number, but got NaN')
    })

    it('should allow custom error message', () => {
      const coerce = Coerce.number('--scale', 'scale must be finite')

      expect(() => coerce('abc')).toThrow('scale must be finite')
    })
  })

  describe('Coerce.integer', () => {
    it('should return parsed integer', () => {
      const coerce = Coerce.integer('--offset')

      expect(coerce('0')).toBe(0)
      expect(coerce('-9')).toBe(-9)
      expect(coerce(' 12 ')).toBe(12)
    })

    it('should throw default error on invalid integer input', () => {
      const coerce = Coerce.integer('--offset')

      expect(() => coerce('1.5')).toThrow('--offset is expected as an integer, but got 1.5')
      expect(() => coerce('abc')).toThrow('--offset is expected as an integer, but got abc')
      expect(() => coerce('Infinity')).toThrow(
        '--offset is expected as an integer, but got Infinity',
      )
      expect(() => coerce('NaN')).toThrow('--offset is expected as an integer, but got NaN')
    })

    it('should allow custom error message', () => {
      const coerce = Coerce.integer('--offset', 'offset must be integer')

      expect(() => coerce('1.5')).toThrow('offset must be integer')
    })
  })

  describe('Coerce.positiveInteger', () => {
    it('should return parsed positive integer', () => {
      const coerce = Coerce.positiveInteger('--parallel')

      expect(coerce('1')).toBe(1)
      expect(coerce('42')).toBe(42)
      expect(coerce(' 8 ')).toBe(8)
    })

    it('should throw default error on invalid integer input', () => {
      const coerce = Coerce.positiveInteger('--parallel')

      expect(() => coerce('0')).toThrow('--parallel is expected as a positive integer, but got 0')
      expect(() => coerce('-1')).toThrow('--parallel is expected as a positive integer, but got -1')
      expect(() => coerce('1.2')).toThrow(
        '--parallel is expected as a positive integer, but got 1.2',
      )
      expect(() => coerce('abc')).toThrow(
        '--parallel is expected as a positive integer, but got abc',
      )
    })

    it('should allow custom error message', () => {
      const coerce = Coerce.positiveInteger('--parallel', 'parallel must be positive integer')

      expect(() => coerce('0')).toThrow('parallel must be positive integer')
    })
  })

  describe('Coerce.positiveNumber', () => {
    it('should return parsed positive number', () => {
      const coerce = Coerce.positiveNumber('--duration')

      expect(coerce('0.1')).toBe(0.1)
      expect(coerce('2')).toBe(2)
      expect(coerce(' 3.5 ')).toBe(3.5)
    })

    it('should throw default error on invalid number input', () => {
      const coerce = Coerce.positiveNumber('--duration')

      expect(() => coerce('0')).toThrow('--duration is expected as a positive number, but got 0')
      expect(() => coerce('-0.1')).toThrow(
        '--duration is expected as a positive number, but got -0.1',
      )
      expect(() => coerce('NaN')).toThrow(
        '--duration is expected as a positive number, but got NaN',
      )
      expect(() => coerce('abc')).toThrow(
        '--duration is expected as a positive number, but got abc',
      )
    })

    it('should allow custom error message', () => {
      const coerce = Coerce.positiveNumber('--duration', 'duration must be positive number')

      expect(() => coerce('0')).toThrow('duration must be positive number')
    })
  })

  describe('Coerce.port', () => {
    it('should return parsed port number', () => {
      const coerce = Coerce.port('--port')

      expect(coerce('0')).toBe(0)
      expect(coerce('80')).toBe(80)
      expect(coerce('65535')).toBe(65535)
    })

    it('should throw default error on invalid port input', () => {
      const coerce = Coerce.port('--port')

      expect(() => coerce('-1')).toThrow(
        '--port is expected as a valid port number (0-65535), but got -1',
      )
      expect(() => coerce('65536')).toThrow(
        '--port is expected as a valid port number (0-65535), but got 65536',
      )
      expect(() => coerce('3.14')).toThrow(
        '--port is expected as a valid port number (0-65535), but got 3.14',
      )
      expect(() => coerce('abc')).toThrow(
        '--port is expected as a valid port number (0-65535), but got abc',
      )
    })

    it('should allow custom error message', () => {
      const coerce = Coerce.port('--port', 'port must be 0-65535')

      expect(() => coerce('65536')).toThrow('port must be 0-65535')
    })
  })

  describe('Coerce.choice', () => {
    it('should return matched enum value', () => {
      const coerce = Coerce.choice('--mode', ['dev', 'test', 'prod'] as const)

      expect(coerce('dev')).toBe('dev')
      expect(coerce('prod')).toBe('prod')
    })

    it('should throw default error on invalid enum input', () => {
      const coerce = Coerce.choice('--mode', ['dev', 'test', 'prod'] as const)

      expect(() => coerce('staging')).toThrow(
        '--mode is expected as one of [dev, test, prod], but got staging',
      )
    })

    it('should allow custom error message', () => {
      const coerce = Coerce.choice(
        '--mode',
        ['dev', 'test', 'prod'] as const,
        'mode must be dev/test/prod',
      )

      expect(() => coerce('staging')).toThrow('mode must be dev/test/prod')
    })
  })
})
