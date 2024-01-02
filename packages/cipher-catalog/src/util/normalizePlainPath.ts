import type { IWorkspacePathResolver } from '@guanghechen/path.types'

export function normalizePlainPath(
  plainFilepath: string,
  plainPathResolver: IWorkspacePathResolver,
): string {
  const relativePlainPath: string = plainPathResolver.relative(plainFilepath, true)
  return relativePlainPath
}
