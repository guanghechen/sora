export interface ISemVer {
  major: number
  minor: number
  patch: number
  prerelease: ReadonlyArray<string | number>
}

export interface IPartialSemVer {
  major: number
  minor: number | undefined
  patch: number | undefined
  prerelease: ReadonlyArray<string | number>
  isWildcard?: boolean
}

export type IComparator = (version: ISemVer) => boolean

export interface IComparatorWithPrerelease {
  comparator: IComparator
  prereleaseVersions: ISemVer[]
}

export interface ISatisfiesOptions {
  /**
   * Include prerelease versions in the comparison.
   * When true, prerelease versions will match ranges even if the range
   * doesn't include a prerelease tag.
   * @default true (for compatibility with compare-versions)
   */
  includePrerelease?: boolean
}
