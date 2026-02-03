import { compareVersions, parseVersion, satisfies } from '../src'

describe('npm semver compatibility', () => {
  describe('Leading v or = prefix', () => {
    it('should parse version with leading v', () => {
      expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    })

    it('should parse version with leading =', () => {
      expect(parseVersion('=1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] })
    })

    it('should compare versions with leading v', () => {
      expect(compareVersions('v1.2.3', '1.2.3')).toBe(0)
      expect(compareVersions('v1.2.4', 'v1.2.3')).toBe(1)
    })

    it('should satisfy with leading v in version', () => {
      expect(satisfies('v1.2.3', '^1.0.0')).toBe(true)
    })

    it('should satisfy with leading v in range', () => {
      expect(satisfies('1.2.3', '^v1.0.0')).toBe(true)
      expect(satisfies('1.2.3', '>=v1.0.0')).toBe(true)
    })
  })

  describe('Tilde with partial versions', () => {
    it('~1 should equal >=1.0.0 <2.0.0-0', () => {
      expect(satisfies('1.0.0', '~1')).toBe(true)
      expect(satisfies('1.5.0', '~1')).toBe(true)
      expect(satisfies('1.99.99', '~1')).toBe(true)
      expect(satisfies('2.0.0', '~1')).toBe(false)
      expect(satisfies('0.9.9', '~1')).toBe(false)
    })

    it('~0 should equal >=0.0.0 <1.0.0-0', () => {
      expect(satisfies('0.0.0', '~0')).toBe(true)
      expect(satisfies('0.5.0', '~0')).toBe(true)
      expect(satisfies('1.0.0', '~0')).toBe(false)
    })
  })

  describe('Caret with x-ranges', () => {
    it('^1.2.x should equal >=1.2.0 <2.0.0-0', () => {
      expect(satisfies('1.2.0', '^1.2.x')).toBe(true)
      expect(satisfies('1.2.5', '^1.2.x')).toBe(true)
      expect(satisfies('1.5.0', '^1.2.x')).toBe(true)
      expect(satisfies('1.99.99', '^1.2.x')).toBe(true)
      expect(satisfies('2.0.0', '^1.2.x')).toBe(false)
      expect(satisfies('1.1.9', '^1.2.x')).toBe(false)
    })

    it('^0.0.x should equal >=0.0.0 <0.1.0-0', () => {
      expect(satisfies('0.0.0', '^0.0.x')).toBe(true)
      expect(satisfies('0.0.5', '^0.0.x')).toBe(true)
      expect(satisfies('0.1.0', '^0.0.x')).toBe(false)
    })

    it('^0.x should equal >=0.0.0 <1.0.0-0', () => {
      expect(satisfies('0.0.0', '^0.x')).toBe(true)
      expect(satisfies('0.5.0', '^0.x')).toBe(true)
      expect(satisfies('0.99.99', '^0.x')).toBe(true)
      expect(satisfies('1.0.0', '^0.x')).toBe(false)
    })

    it('^1.x should equal >=1.0.0 <2.0.0-0', () => {
      expect(satisfies('1.0.0', '^1.x')).toBe(true)
      expect(satisfies('1.99.99', '^1.x')).toBe(true)
      expect(satisfies('2.0.0', '^1.x')).toBe(false)
    })
  })

  describe('Tilde with x-ranges', () => {
    it('~1.2.x should equal >=1.2.0 <1.3.0-0', () => {
      expect(satisfies('1.2.0', '~1.2.x')).toBe(true)
      expect(satisfies('1.2.5', '~1.2.x')).toBe(true)
      expect(satisfies('1.3.0', '~1.2.x')).toBe(false)
    })
  })
})
