import type { IPathResolver, IWorkspacePathResolver } from '@guanghechen/path.types'
import { PhysicalPathResolver } from './PhysicalPathResolver'
import { WorkspacePathResolver } from './WorkspacePathResolver'

export class PhysicalWorkspacePathResolver
  extends WorkspacePathResolver
  implements IWorkspacePathResolver
{
  constructor(root: string) {
    const pathResolver: IPathResolver = new PhysicalPathResolver()
    super(root, pathResolver)
  }
}
