import { parseVersion } from './parse'
import type { ISemVer } from './types'

function comparePrerelease(
  a: ReadonlyArray<string | number>,
  b: ReadonlyArray<string | number>,
): -1 | 0 | 1 {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1

  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (i >= a.length) return -1
    if (i >= b.length) return 1

    const aVal = a[i]
    const bVal = b[i]
    if (aVal === bVal) continue

    const aIsNum = typeof aVal === 'number'
    const bIsNum = typeof bVal === 'number'

    if (aIsNum !== bIsNum) return aIsNum ? -1 : 1
    return aVal < bVal ? -1 : 1
  }

  return 0
}

export function compareSemVer(v1: ISemVer, v2: ISemVer): -1 | 0 | 1 {
  if (v1.major !== v2.major) return v1.major < v2.major ? -1 : 1
  if (v1.minor !== v2.minor) return v1.minor < v2.minor ? -1 : 1
  if (v1.patch !== v2.patch) return v1.patch < v2.patch ? -1 : 1
  return comparePrerelease(v1.prerelease, v2.prerelease)
}

export function compareVersions(v1: string, v2: string): -1 | 0 | 1 {
  const parsed1 = parseVersion(v1)
  const parsed2 = parseVersion(v2)

  if (!parsed1 || !parsed2) {
    throw new Error(`Invalid version: ${!parsed1 ? v1 : v2}`)
  }

  return compareSemVer(parsed1, parsed2)
}
