import type { IPathResolver, IWorkspacePathResolver } from '@guanghechen/path.types'

const clazz: string = 'WorkspacePathResolver'

export class WorkspacePathResolver implements IWorkspacePathResolver {
  public readonly root: string
  public readonly pathResolver: IPathResolver

  constructor(root: string, pathResolver: IPathResolver) {
    this.root = root
    this.pathResolver = pathResolver
  }

  public ensureSafePath(filepath: string, message?: string | undefined): void | never {
    if (this.isSafePath(filepath)) return
    throw new Error(message ?? `[${clazz}] not an absolute path: ${filepath}.`)
  }

  public isSafePath(filepath: string): boolean {
    const { root, pathResolver } = this
    if (!pathResolver.isAbsolute(filepath)) return true
    if (filepath === root) return true
    const relativePath: string = pathResolver.relative(root, filepath)
    return !relativePath.startsWith('..')
  }

  public resolve(filepath: string): string | never {
    this.ensureSafePath(filepath)
    const { root, pathResolver } = this
    if (pathResolver.isAbsolute(filepath)) return pathResolver.normalize(filepath)
    return pathResolver.join(root, filepath)
  }

  public relative(filepath_: string): string | never {
    this.ensureSafePath(filepath_)
    const filepath: string = this.resolve(filepath_)
    return this.pathResolver.relative(this.root, filepath)
  }
}
