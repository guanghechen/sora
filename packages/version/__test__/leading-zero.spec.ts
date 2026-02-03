import { compareVersions, parseVersion } from '../src'

describe('leading zero in prerelease', () => {
  it('should treat 01 as string (not number)', () => {
    // semver spec: 01 has leading zero, should be string
    const v1 = parseVersion('1.0.0-01')
    const v2 = parseVersion('1.0.0-1')

    // 01 should be string, 1 should be number
    expect(v1?.prerelease[0]).toBe('01') // string
    expect(v2?.prerelease[0]).toBe(1) // number
  })

  it('should compare 1.0.0-1 < 1.0.0-01 (number < string in semver)', () => {
    // In semver, numeric < alphanumeric
    expect(compareVersions('1.0.0-1', '1.0.0-01')).toBe(-1)
  })
})
