export interface IPathResolverParams {
  /**
   * Default value of the 'relative' params, if enabled, will replace all '\\' to '/'.
   * @default false
   */
  preferSlash?: boolean
}

export interface IPathResolver {
  /**
   * Return the last portion of a path.
   * @param filepath
   * @throws when the `filepath` is not an absolute path.
   */
  basename(filepath: string): string | never

  /**
   * Throw error if the given filepath is not an absolute path.
   * @param filepath should be an absolute path.
   * @param message error message to throw when the given filepath is not an absolute path.
   * @throws when the `filepath` is not an absolute path.
   */
  ensureAbsolute(filepath: string, message?: string): void | never

  /**
   * Ensure the given filepath is an absolute filepath and under the `root`.
   * @param root an absolute path.
   * @param filepath should be an absolute path.
   * @param message error message to throw when the given filepath is not an absolute path.
   * @throws when the filepath is not an absolute path under the `root`.
   */
  ensureSafeRelative(root: string, filepath: string, message?: string): void | never

  /**
   * Get the parent path of the given absolute path.
   * @param filepath should be an absolute path.
   * @throws when the `filepath` is not an absolute path.
   */
  dirname(filepath: string): string | never

  /**
   * Check if the given path is an absolute path.
   * @param filepath should be an absolute path.
   */
  isAbsolute(filepath: string): boolean

  /**
   * Check if the given filepath is an absolute filepath and under the `root`.
   * @param root
   * @param filepath
   */
  isSafeRelative(root: string, filepath: string): boolean

  /**
   * Join path
   * @param filepath should be an absolute path.
   * @param pathPieces non-absolute path pieces.
   * @throws when the `filepath` is not an absolute path or any path piece should be non-absolute path.
   */
  join(filepath: string, ...pathPieces: string[]): string | never

  /**
   * Normalize the given absolute path.
   * @param filepath
   * @throws when the `filepath` is not an absolute path.
   */
  normalize(filepath: string): string | never

  /**
   * Calc relative path.
   * @param from should be an absolute path.
   * @param to should be an absolute path.
   * @param preferSlash if enabled, will replace all '\\' to '/'.
   * @throws when the `from` or `to` is not an absolute path.
   */
  relative(from: string, to: string, preferSlash?: boolean): string | never

  /**
   * Solve the relative path based on the `root`.
   * @param root should be an absolute path.
   * @param filepath should be an path (not require absolute) under the `root`.
   * @param preferSlash if enabled, will replace all '\\' to '/'.
   * @throws when the `filepath` is not under the `root`.
   */
  safeRelative(root: string, filepath: string, preferSlash?: boolean): string

  /**
   * Resolve the given `filepath` to an absolute path based on the `root`.
   * @param root should be an absolute path.
   * @param filepath should be an path (not require absolute) under the `root`.
   * @throws when `root` is not an absolute path or the `filepath` is not under the `root`.
   */
  safeResolve(root: string, filepath: string): string
}

export interface IWorkspacePathResolver {
  /**
   * Root path of the workspace.
   */
  readonly root: string

  /**
   * Path resolver.
   */
  readonly pathResolver: IPathResolver

  /**
   * Ensure the given filepath is under the `root`.
   * @param filepath
   * @param message error message to throw when the given filepath is not an absolute path.
   * @throws when the filepath is not an absolute path and not under the `root`.
   */
  ensureSafePath(filepath: string, message?: string): void | never

  /**
   * Check if the given filepath is under the `root`.
   * @param filepath
   */
  isSafePath(filepath: string): boolean

  /**
   * Solve the relative path based on the `root`.
   * @param filepath should be an absolute path under the `root`.
   * @param preferSlash if enabled, will replace all '\\' to '/'.
   * @throws when the filepath is an absolute path and under the `root`.
   */
  relative(filepath: string, preferSlash?: boolean): string | never

  /**
   * Resolve the given filepath to an absolute path.
   * @param filepath should be an absolute path under the `root` or relative path.
   * @throws when the filepath is an absolute path and under the `root`.
   */
  resolve(filepath: string): string | never
}
