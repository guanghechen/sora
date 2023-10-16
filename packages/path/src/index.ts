import type { IPathResolver } from '@guanghechen/path.types'
import { PhysicalPathResolver } from './PhysicalPathResolver'
import { VirtualPathResolver } from './VirtualPathResolver'

export * from './util/locate'

export * from './PhysicalPathResolver'
export * from './PhysicalWorkspacePathResolver'
export * from './VirtualPathResolver'
export * from './VirtualWorkspacePathResolver'
export * from './WorkspacePathResolver'

// Re-export types and constants
export * from '@guanghechen/path.types'

export const physicalPathResolver: IPathResolver = new PhysicalPathResolver()
export const virtualPathResolver: IPathResolver = new VirtualPathResolver()
