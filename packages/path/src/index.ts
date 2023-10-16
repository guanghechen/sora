import type { IPathResolver } from '@guanghechen/path.types'
import { PathResolver } from './PathResolver'
import { UrlPathResolver } from './UrlPathResolver'

export * from './util/locate'

export * from './PathResolver'
export * from './UrlPathResolver'
export * from './WorkspacePathResolver'

// Re-export types and constants
export * from '@guanghechen/path.types'

export const pathResolver: IPathResolver = new PathResolver()
export const urlPathResolver: IPathResolver = new UrlPathResolver()
