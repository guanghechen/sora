import {
  formatVersion,
  isFullVersion,
  parsePartialVersion,
  parseVersion,
  toFullVersion,
} from '../src'

describe('parseVersion', () => {
  it('should parse simple versions', () => {
    expect(parseVersion('1.0.0')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [] })
    expect(parseVersion('2.3.4')).toEqual({ major: 2, minor: 3, patch: 4, prerelease: [] })
    expect(parseVersion('0.0.1')).toEqual({ major: 0, minor: 0, patch: 1, prerelease: [] })
  })

  it('should parse versions with v prefix', () => {
    expect(parseVersion('v1.0.0')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [] })
    expect(parseVersion('v2.3.4')).toEqual({ major: 2, minor: 3, patch: 4, prerelease: [] })
  })

  it('should parse versions with = prefix', () => {
    expect(parseVersion('=1.0.0')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [] })
    expect(parseVersion('=2.3.4')).toEqual({ major: 2, minor: 3, patch: 4, prerelease: [] })
  })

  it('should parse versions with prerelease', () => {
    expect(parseVersion('1.0.0-alpha')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: ['alpha'],
    })
    expect(parseVersion('1.0.0-alpha.1')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: ['alpha', 1],
    })
    expect(parseVersion('2.0.0-beta.2.rc')).toEqual({
      major: 2,
      minor: 0,
      patch: 0,
      prerelease: ['beta', 2, 'rc'],
    })
  })

  it('should parse versions with build metadata (ignoring it)', () => {
    expect(parseVersion('1.0.0+build')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [] })
    expect(parseVersion('1.0.0+20130313144700')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: [],
    })
    expect(parseVersion('1.0.0+build.123')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: [],
    })
    expect(parseVersion('1.0.0-alpha+build')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: ['alpha'],
    })
  })

  it('should return undefined for invalid versions', () => {
    expect(parseVersion('invalid')).toBeUndefined()
    expect(parseVersion('1.0')).toBeUndefined()
    expect(parseVersion('1')).toBeUndefined()
    expect(parseVersion('1.0.0.0')).toBeUndefined()
    expect(parseVersion('')).toBeUndefined()
  })
})

describe('parsePartialVersion', () => {
  describe('wildcards', () => {
    it('should parse * as wildcard', () => {
      const result = parsePartialVersion('*')
      expect(result).toEqual({
        major: 0,
        minor: undefined,
        patch: undefined,
        prerelease: [],
        isWildcard: true,
      })
    })

    it('should parse x as wildcard', () => {
      const result = parsePartialVersion('x')
      expect(result).toEqual({
        major: 0,
        minor: undefined,
        patch: undefined,
        prerelease: [],
        isWildcard: true,
      })
    })

    it('should parse X as wildcard', () => {
      const result = parsePartialVersion('X')
      expect(result).toEqual({
        major: 0,
        minor: undefined,
        patch: undefined,
        prerelease: [],
        isWildcard: true,
      })
    })

    it('should parse empty string as wildcard', () => {
      const result = parsePartialVersion('')
      expect(result).toEqual({
        major: 0,
        minor: undefined,
        patch: undefined,
        prerelease: [],
        isWildcard: true,
      })
    })

    it('should parse 1.x as partial', () => {
      const result = parsePartialVersion('1.x')
      expect(result).toEqual({ major: 1, minor: undefined, patch: undefined, prerelease: [] })
    })

    it('should parse 1.X as partial', () => {
      const result = parsePartialVersion('1.X')
      expect(result).toEqual({ major: 1, minor: undefined, patch: undefined, prerelease: [] })
    })

    it('should parse 1.* as partial', () => {
      const result = parsePartialVersion('1.*')
      expect(result).toEqual({ major: 1, minor: undefined, patch: undefined, prerelease: [] })
    })

    it('should parse 1.2.x as partial', () => {
      const result = parsePartialVersion('1.2.x')
      expect(result).toEqual({ major: 1, minor: 2, patch: undefined, prerelease: [] })
    })

    it('should parse 1.2.X as partial', () => {
      const result = parsePartialVersion('1.2.X')
      expect(result).toEqual({ major: 1, minor: 2, patch: undefined, prerelease: [] })
    })

    it('should parse 1.2.* as partial', () => {
      const result = parsePartialVersion('1.2.*')
      expect(result).toEqual({ major: 1, minor: 2, patch: undefined, prerelease: [] })
    })

    it('should parse 1.x.x as partial', () => {
      const result = parsePartialVersion('1.x.x')
      expect(result).toEqual({ major: 1, minor: undefined, patch: undefined, prerelease: [] })
    })
  })

  describe('partial versions', () => {
    it('should parse 1 as partial', () => {
      const result = parsePartialVersion('1')
      expect(result).toEqual({ major: 1, minor: undefined, patch: undefined, prerelease: [] })
    })

    it('should parse 1.2 as partial', () => {
      const result = parsePartialVersion('1.2')
      expect(result).toEqual({ major: 1, minor: 2, patch: undefined, prerelease: [] })
    })

    it('should parse full version', () => {
      const result = parsePartialVersion('1.2.3')
      expect(result).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    })
  })

  describe('with prerelease', () => {
    it('should parse 1.2.3-alpha', () => {
      const result = parsePartialVersion('1.2.3-alpha')
      expect(result).toEqual({ major: 1, minor: 2, patch: 3, prerelease: ['alpha'] })
    })

    it('should parse 1.2.3-alpha.1', () => {
      const result = parsePartialVersion('1.2.3-alpha.1')
      expect(result).toEqual({ major: 1, minor: 2, patch: 3, prerelease: ['alpha', 1] })
    })
  })

  describe('with build metadata', () => {
    it('should parse 1.2.3+build', () => {
      const result = parsePartialVersion('1.2.3+build')
      expect(result).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    })

    it('should parse 1.2.3-alpha+build', () => {
      const result = parsePartialVersion('1.2.3-alpha+build')
      expect(result).toEqual({ major: 1, minor: 2, patch: 3, prerelease: ['alpha'] })
    })
  })

  describe('with v prefix', () => {
    it('should parse v1.2.3', () => {
      const result = parsePartialVersion('v1.2.3')
      expect(result).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    })

    it('should parse v1.2', () => {
      const result = parsePartialVersion('v1.2')
      expect(result).toEqual({ major: 1, minor: 2, patch: undefined, prerelease: [] })
    })

    it('should parse v1', () => {
      const result = parsePartialVersion('v1')
      expect(result).toEqual({ major: 1, minor: undefined, patch: undefined, prerelease: [] })
    })
  })
})

describe('isFullVersion', () => {
  it('should return true for full versions', () => {
    expect(isFullVersion({ major: 1, minor: 2, patch: 3, prerelease: [] })).toBe(true)
  })

  it('should return false for partial versions', () => {
    expect(isFullVersion({ major: 1, minor: undefined, patch: undefined, prerelease: [] })).toBe(
      false,
    )
    expect(isFullVersion({ major: 1, minor: 2, patch: undefined, prerelease: [] })).toBe(false)
  })
})

describe('toFullVersion', () => {
  it('should fill in missing parts with 0', () => {
    expect(toFullVersion({ major: 1, minor: undefined, patch: undefined, prerelease: [] })).toEqual(
      {
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: [],
      },
    )
    expect(toFullVersion({ major: 1, minor: 2, patch: undefined, prerelease: [] })).toEqual({
      major: 1,
      minor: 2,
      patch: 0,
      prerelease: [],
    })
  })

  it('should preserve full versions', () => {
    expect(toFullVersion({ major: 1, minor: 2, patch: 3, prerelease: ['alpha'] })).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: ['alpha'],
    })
  })
})

describe('formatVersion', () => {
  it('should format basic versions', () => {
    expect(formatVersion({ major: 1, minor: 2, patch: 3, prerelease: [] })).toBe('1.2.3')
  })

  it('should format versions with prerelease', () => {
    expect(formatVersion({ major: 1, minor: 2, patch: 3, prerelease: ['alpha'] })).toBe(
      '1.2.3-alpha',
    )
    expect(formatVersion({ major: 1, minor: 2, patch: 3, prerelease: ['alpha', 1] })).toBe(
      '1.2.3-alpha.1',
    )
  })
})
