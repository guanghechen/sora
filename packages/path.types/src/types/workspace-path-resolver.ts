import { IPathResolver } from './path-resolver'

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
   * Ensure the given filepath is an absolute filepath and under the `root`.
   * @param filepath should be an absolute path.
   * @param message error message to throw when the given filepath is not an absolute path.
   * @throws when the filepath is not an absolute path under the `root`.
   */
  ensureSafePath(filepath: string, message?: string): void | never

  /**
   * Check if the given filepath is an absolute filepath and under the `root`.
   * @param filepath
   */
  isSafePath(filepath: string): boolean | never

  /**
   * Resolve the given filepath to an absolute path.
   * @param filepath should be an absolute path under the `root` or relative path.
   * @throws when the filepath is an absolute path and under the `root`.
   */
  resolve(filepath: string): string | never

  /**
   * Solve the relative path based on the `root`.
   * @param filepath should be an absolute path under the `root`.
   * @throws when the filepath is an absolute path and under the `root`.
   */
  relative(filepath: string): string | never
}
