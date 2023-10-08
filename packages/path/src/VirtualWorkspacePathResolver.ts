import type { IPathResolver, IWorkspacePathResolver } from '@guanghechen/path.types'
import { VirtualPathResolver } from './VirtualPathResolver'
import { WorkspacePathResolver } from './WorkspacePathResolver'

export class VirtualWorkspacePathResolver
  extends WorkspacePathResolver
  implements IWorkspacePathResolver
{
  constructor(root: string) {
    const pathResolver: IPathResolver = new VirtualPathResolver()
    super(root, pathResolver)
  }
}
