import type { IPartialSemVer, ISemVer } from './types'

const SEMVER_REGEX =
  /^[v=]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const PARTIAL_SEMVER_REGEX =
  /^[v=]?(\d+)(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function isWildcardChar(s: string | undefined): boolean {
  return s === '*' || s === 'x' || s === 'X'
}

function parsePrerelease(prereleaseStr: string | undefined): Array<string | number> {
  if (!prereleaseStr) return []
  return prereleaseStr.split('.').map(part => {
    const num = parseInt(part, 10)
    return String(num) === part ? num : part
  })
}

export function parseVersion(version: string): ISemVer | undefined {
  const match = SEMVER_REGEX.exec(version)
  if (!match) return undefined

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: parsePrerelease(match[4]),
  }
}

export function parsePartialVersion(version: string): IPartialSemVer | undefined {
  const trimmed = version.trim()
  if (trimmed === '' || isWildcardChar(trimmed)) {
    return { major: 0, minor: undefined, patch: undefined, prerelease: [], isWildcard: true }
  }

  const match = PARTIAL_SEMVER_REGEX.exec(trimmed)
  if (!match) return undefined

  const minorStr = match[2]
  const patchStr = match[3]

  return {
    major: parseInt(match[1], 10),
    minor: minorStr === undefined || isWildcardChar(minorStr) ? undefined : parseInt(minorStr, 10),
    patch: patchStr === undefined || isWildcardChar(patchStr) ? undefined : parseInt(patchStr, 10),
    prerelease: parsePrerelease(match[4]),
  }
}

export function isFullVersion(v: IPartialSemVer): v is ISemVer {
  return v.minor !== undefined && v.patch !== undefined
}

export function toFullVersion(v: IPartialSemVer): ISemVer {
  return {
    major: v.major,
    minor: v.minor ?? 0,
    patch: v.patch ?? 0,
    prerelease: v.prerelease,
  }
}

export function formatVersion(v: ISemVer): string {
  const base = `${v.major}.${v.minor}.${v.patch}`
  return v.prerelease.length === 0 ? base : `${base}-${v.prerelease.join('.')}`
}
