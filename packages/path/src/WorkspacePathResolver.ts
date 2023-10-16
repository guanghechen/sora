import type { IPathResolver, IWorkspacePathResolver } from '@guanghechen/path.types'

export class WorkspacePathResolver implements IWorkspacePathResolver {
  public readonly root: string
  public readonly pathResolver: IPathResolver

  constructor(root: string, pathResolver: IPathResolver) {
    this.root = root
    this.pathResolver = pathResolver
  }

  public ensureSafePath(filepath: string, message?: string | undefined): void | never {
    const { root, pathResolver } = this
    pathResolver.ensureSafeRelative(root, filepath, message)
  }

  public isSafePath(filepath: string): boolean {
    const { root, pathResolver } = this
    return pathResolver.isSafeRelative(root, filepath)
  }

  public relative(filepath: string): string | never {
    const { root, pathResolver } = this
    return pathResolver.safeRelative(root, filepath)
  }

  public resolve(filepath: string): string | never {
    const { root, pathResolver } = this
    return pathResolver.safeResolve(root, filepath)
  }
}
