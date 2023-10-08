export interface IPathResolver {
  /**
   * Return the last portion of a path.
   * @param filepath
   */
  basename(filepath: string): string | never

  /**
   * Throw error if the given filepath is not an absolute path.
   * @param filepath should be an absolute path.
   * @param message error message to throw when the given filepath is not an absolute path.
   */
  ensureAbsolute(filepath: string, message?: string): void | never

  /**
   * Get the parent path of the given absolute path.
   * @param filepath should be an absolute path.
   */
  dirname(filepath: string): string | never

  /**
   * Check if the given path is an absolute path.
   * @param filepath should be an absolute path.
   */
  isAbsolute(filepath: string): boolean | never

  /**
   * Join path
   * @param filepath should be an absolute path.
   * @param pathPieces each path piece should be non-absolute path.
   */
  join(filepath: string, ...pathPieces: string[]): string | never

  /**
   * Normalize the given absolute path.
   * @param filepath
   */
  normalize(filepath: string): string | never

  /**
   * Calc relative path.
   * @param from should be an absolute path.
   * @param to should be an absolute path.
   */
  relative(from: string, to: string): string | never
}
