import { type ISemVer, compareSemVer, compareVersions } from '../src'

describe('compareSemVer', () => {
  it('should compare ISemVer objects directly', () => {
    const v1: ISemVer = { major: 1, minor: 0, patch: 0, prerelease: [] }
    const v2: ISemVer = { major: 2, minor: 0, patch: 0, prerelease: [] }
    expect(compareSemVer(v1, v2)).toBe(-1)
    expect(compareSemVer(v2, v1)).toBe(1)
    expect(compareSemVer(v1, v1)).toBe(0)
  })

  it('should compare by minor version', () => {
    const v1: ISemVer = { major: 1, minor: 1, patch: 0, prerelease: [] }
    const v2: ISemVer = { major: 1, minor: 2, patch: 0, prerelease: [] }
    expect(compareSemVer(v1, v2)).toBe(-1)
    expect(compareSemVer(v2, v1)).toBe(1)
  })

  it('should compare by patch version', () => {
    const v1: ISemVer = { major: 1, minor: 0, patch: 1, prerelease: [] }
    const v2: ISemVer = { major: 1, minor: 0, patch: 2, prerelease: [] }
    expect(compareSemVer(v1, v2)).toBe(-1)
    expect(compareSemVer(v2, v1)).toBe(1)
  })

  it('should compare prerelease versions', () => {
    const stable: ISemVer = { major: 1, minor: 0, patch: 0, prerelease: [] }
    const alpha: ISemVer = { major: 1, minor: 0, patch: 0, prerelease: ['alpha'] }
    expect(compareSemVer(stable, alpha)).toBe(1)
    expect(compareSemVer(alpha, stable)).toBe(-1)
  })

  it('should compare prerelease identifiers', () => {
    const alpha1: ISemVer = { major: 1, minor: 0, patch: 0, prerelease: ['alpha', 1] }
    const alpha2: ISemVer = { major: 1, minor: 0, patch: 0, prerelease: ['alpha', 2] }
    expect(compareSemVer(alpha1, alpha2)).toBe(-1)
    expect(compareSemVer(alpha2, alpha1)).toBe(1)
  })

  it('should compare numeric vs string prerelease', () => {
    const num: ISemVer = { major: 1, minor: 0, patch: 0, prerelease: [1] }
    const str: ISemVer = { major: 1, minor: 0, patch: 0, prerelease: ['alpha'] }
    expect(compareSemVer(num, str)).toBe(-1)
    expect(compareSemVer(str, num)).toBe(1)
  })

  it('should compare prerelease by length', () => {
    const short: ISemVer = { major: 1, minor: 0, patch: 0, prerelease: ['alpha'] }
    const long: ISemVer = { major: 1, minor: 0, patch: 0, prerelease: ['alpha', 1] }
    expect(compareSemVer(short, long)).toBe(-1)
    expect(compareSemVer(long, short)).toBe(1)
  })
})

describe('compareVersions', () => {
  it('should compare major versions', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('should compare minor versions', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBe(1)
    expect(compareVersions('1.1.0', '1.2.0')).toBe(-1)
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0)
  })

  it('should compare patch versions', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBe(1)
    expect(compareVersions('1.0.1', '1.0.2')).toBe(-1)
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0)
  })

  it('should compare prerelease versions', () => {
    expect(compareVersions('1.0.0', '1.0.0-alpha')).toBe(1)
    expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0-alpha', '1.0.0-alpha')).toBe(0)
    expect(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.1')).toBe(1)
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1)
    expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1)
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1)
  })

  it('should handle prerelease length differences', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1)
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha')).toBe(1)
  })

  it('should ignore build metadata in comparison', () => {
    expect(compareVersions('1.0.0+build1', '1.0.0+build2')).toBe(0)
    expect(compareVersions('1.0.0+build', '1.0.0')).toBe(0)
  })

  it('should handle v prefix', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1)
  })

  it('should throw for invalid versions', () => {
    expect(() => compareVersions('invalid', '1.0.0')).toThrow()
    expect(() => compareVersions('1.0.0', 'invalid')).toThrow()
  })
})
