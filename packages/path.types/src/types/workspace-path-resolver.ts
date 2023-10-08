export interface IWorkspacePathResolver {
  /**
   * Root path.
   */
  readonly root: string

  /**
   * Ensure the given filepath is an absolute filepath and under the `root`.
   * @param filepath should be an absolute path.
   * @throws when the filepath is not an absolute path under the `root`.
   */
  ensureSafePath(filepath: string): void | never

  /**
   * Check if the given filepath is an absolute filepath and under the `root`.
   * @param filepath should be an absolute path.
   * @throws when the filepath is not an absolute path under the `root`.
   */
  isSafePath(filepath: string): boolean | never

  /**
   * Resolve the given filepath to an absolute path.
   * @param filepath should be an absolute path under the `root` or relative path.
   */
  resolve(filepath: string): string | never

  /**
   * Solve the relative path based on the `root`.
   * @param filepath should be an absolute path under the `root`.
   * @throws when the filepath is not an absolute path under the `root`.
   */
  relative(filepath: string): string | never
}
