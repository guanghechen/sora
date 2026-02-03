import { compareSemVer } from './compare'
import { isFullVersion, parsePartialVersion, parseVersion, toFullVersion } from './parse'
import type {
  IComparator,
  IComparatorWithPrerelease,
  IPartialSemVer,
  ISatisfiesOptions,
  ISemVer,
} from './types'

const HYPHEN_RANGE_REGEX = /^\s*(\S+)\s+-\s+(\S+)\s*$/
const COMPARATOR_REGEX = /^(>=|>|<=|<|=|\^|~)?(.*)$/

function createComparator(target: ISemVer, op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq'): IComparator {
  return (v: ISemVer) => {
    const cmp = compareSemVer(v, target)
    if (op === 'gt') return cmp > 0
    if (op === 'gte') return cmp >= 0
    if (op === 'lt') return cmp < 0
    if (op === 'lte') return cmp <= 0
    return cmp === 0
  }
}

function createAndComparator(comparators: IComparator[]): IComparator {
  return (v: ISemVer) => comparators.every(c => c(v))
}

function createSemVer(
  major: number,
  minor: number,
  patch: number,
  prerelease: ReadonlyArray<string | number> = [],
): ISemVer {
  return { major, minor, patch, prerelease: [...prerelease] }
}

function withResult(
  comparator: IComparator,
  prereleaseVersions: ISemVer[],
): IComparatorWithPrerelease {
  return { comparator, prereleaseVersions }
}

function hasSameBaseVersion(v1: ISemVer, v2: ISemVer): boolean {
  return v1.major === v2.major && v1.minor === v2.minor && v1.patch === v2.patch
}

function parseHyphenRange(range: string): IComparatorWithPrerelease[] | undefined {
  const match = HYPHEN_RANGE_REGEX.exec(range)
  if (!match) return undefined

  const start = parsePartialVersion(match[1])
  const end = parsePartialVersion(match[2])
  if (!start || !end) return undefined

  const startFull = toFullVersion(start)
  const comparators: IComparator[] = [createComparator(startFull, 'gte')]
  const prereleaseVersions: ISemVer[] = []

  if (start.prerelease.length > 0) prereleaseVersions.push(startFull)

  if (isFullVersion(end)) {
    comparators.push(createComparator(end, 'lte'))
    if (end.prerelease.length > 0) prereleaseVersions.push(end)
  } else {
    const endMax =
      end.minor === undefined
        ? createSemVer(end.major + 1, 0, 0, [0])
        : createSemVer(end.major, end.minor + 1, 0, [0])
    comparators.push(createComparator(endMax, 'lt'))
  }

  return [withResult(createAndComparator(comparators), prereleaseVersions)]
}

function parseXRange(partial: IPartialSemVer): IComparatorWithPrerelease {
  if (partial.minor === undefined) {
    if (partial.isWildcard) return withResult(() => true, [])
    const min = createSemVer(partial.major, 0, 0, partial.prerelease)
    const max = createSemVer(partial.major + 1, 0, 0, [0])
    return withResult(
      createAndComparator([createComparator(min, 'gte'), createComparator(max, 'lt')]),
      partial.prerelease.length > 0 ? [min] : [],
    )
  }

  const min = createSemVer(partial.major, partial.minor, 0, partial.prerelease)
  const max = createSemVer(partial.major, partial.minor + 1, 0, [0])
  return withResult(
    createAndComparator([createComparator(min, 'gte'), createComparator(max, 'lt')]),
    partial.prerelease.length > 0 ? [min] : [],
  )
}

function parseCaretRange(partial: IPartialSemVer): IComparatorWithPrerelease {
  const min = toFullVersion(partial)
  const hasPrerelease = partial.prerelease.length > 0

  let max: ISemVer
  if (partial.minor === undefined) {
    max = createSemVer(min.major + 1, 0, 0, [0])
  } else if (partial.patch === undefined) {
    if (min.major === 0 && min.minor === 0) {
      max = createSemVer(0, 1, 0, [0])
    } else if (min.major === 0) {
      max = createSemVer(0, min.minor + 1, 0, [0])
    } else {
      max = createSemVer(min.major + 1, 0, 0, [0])
    }
  } else if (min.major > 0) {
    max = createSemVer(min.major + 1, 0, 0, [0])
  } else if (min.minor > 0) {
    max = createSemVer(0, min.minor + 1, 0, [0])
  } else {
    max = createSemVer(0, 0, min.patch + 1, [0])
  }

  return withResult(
    createAndComparator([createComparator(min, 'gte'), createComparator(max, 'lt')]),
    hasPrerelease ? [min] : [],
  )
}

function parseTildeRange(partial: IPartialSemVer): IComparatorWithPrerelease {
  const min = toFullVersion(partial)
  const hasPrerelease = partial.prerelease.length > 0

  const max =
    partial.minor === undefined
      ? createSemVer(min.major + 1, 0, 0, [0])
      : createSemVer(min.major, min.minor + 1, 0, [0])

  return withResult(
    createAndComparator([createComparator(min, 'gte'), createComparator(max, 'lt')]),
    hasPrerelease ? [min] : [],
  )
}

type IOperator = '' | '=' | '>' | '>=' | '<' | '<=' | '^' | '~'

function parseComparatorWithOperator(
  operator: IOperator,
  partial: IPartialSemVer,
): IComparatorWithPrerelease {
  const hasPrerelease = partial.prerelease.length > 0

  switch (operator) {
    case '':
    case '=': {
      if (!isFullVersion(partial)) return parseXRange(partial)
      return withResult(createComparator(partial, 'eq'), hasPrerelease ? [partial] : [])
    }

    case '>': {
      if (!isFullVersion(partial)) {
        const target =
          partial.minor === undefined
            ? createSemVer(partial.major + 1, 0, 0)
            : createSemVer(partial.major, partial.minor + 1, 0)
        return withResult(
          createComparator(target, 'gte'),
          hasPrerelease ? [toFullVersion(partial)] : [],
        )
      }
      return withResult(createComparator(partial, 'gt'), hasPrerelease ? [partial] : [])
    }

    case '>=': {
      const full = toFullVersion(partial)
      return withResult(createComparator(full, 'gte'), hasPrerelease ? [full] : [])
    }

    case '<': {
      if (!isFullVersion(partial)) {
        const target = toFullVersion(partial)
        const targetWithPrerelease = createSemVer(target.major, target.minor, target.patch, [0])
        return withResult(
          createComparator(targetWithPrerelease, 'lt'),
          hasPrerelease ? [target] : [],
        )
      }
      return withResult(createComparator(partial, 'lt'), hasPrerelease ? [partial] : [])
    }

    case '<=': {
      if (!isFullVersion(partial)) {
        const target =
          partial.minor === undefined
            ? createSemVer(partial.major + 1, 0, 0, [0])
            : createSemVer(partial.major, partial.minor + 1, 0, [0])
        return withResult(
          createComparator(target, 'lt'),
          hasPrerelease ? [toFullVersion(partial)] : [],
        )
      }
      return withResult(createComparator(partial, 'lte'), hasPrerelease ? [partial] : [])
    }

    case '^':
      return parseCaretRange(partial)

    case '~':
      return parseTildeRange(partial)
  }
}

const OPERATORS: ReadonlyArray<IOperator> = ['>=', '>', '<=', '<', '=', '^', '~', '']

function isOperator(s: string): s is IOperator {
  return (OPERATORS as ReadonlyArray<string>).includes(s)
}

function parseSingleComparator(comp: string): IComparatorWithPrerelease | undefined {
  const trimmed = comp.trim()
  if (trimmed === '' || trimmed === '*' || trimmed === 'x' || trimmed === 'X') {
    return withResult(() => true, [])
  }

  const match = COMPARATOR_REGEX.exec(trimmed)
  if (!match) return undefined

  const operator = match[1] || ''
  const versionStr = match[2]

  if (!versionStr) {
    return operator === '' ? withResult(() => true, []) : undefined
  }

  const partial = parsePartialVersion(versionStr)
  if (!partial || !isOperator(operator)) return undefined

  return parseComparatorWithOperator(operator, partial)
}

function parseComparatorSet(set: string): IComparatorWithPrerelease[] | undefined {
  const hyphenResult = parseHyphenRange(set)
  if (hyphenResult) return hyphenResult

  const parts = set.trim().split(/\s+/)
  const results: IComparatorWithPrerelease[] = []

  for (const part of parts) {
    if (part === '') continue
    const parsed = parseSingleComparator(part)
    if (!parsed) return undefined
    results.push(parsed)
  }

  return results.length === 0 ? [withResult(() => true, [])] : results
}

function checkPrereleaseAllowed(version: ISemVer, prereleaseVersions: ISemVer[]): boolean {
  if (version.prerelease.length === 0) return true
  return prereleaseVersions.some(pv => hasSameBaseVersion(version, pv))
}

export function satisfies(version: string, range: string, options?: ISatisfiesOptions): boolean {
  const parsed = parseVersion(version)
  if (!parsed) return false

  const includePrerelease = options?.includePrerelease ?? true

  for (const orPart of range.split('||')) {
    const comparatorSet = parseComparatorSet(orPart)
    if (!comparatorSet) continue

    const allMatch = comparatorSet.every(c => c.comparator(parsed))
    if (!allMatch) continue

    if (includePrerelease) return true

    const prereleaseVersions = comparatorSet.flatMap(c => c.prereleaseVersions)
    if (checkPrereleaseAllowed(parsed, prereleaseVersions)) return true
  }

  return false
}
