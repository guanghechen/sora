import { DEFAULT_FILEPART_CODE_PREFIX } from '@guanghechen/filepart'
import type { IReporter } from '@guanghechen/reporter.types'
import type { IVirtualFileSystem } from '@guanghechen/vfs.types'
import { VirtualFileSystem } from './filesystem'
import { VfsPathResolver } from './path'

interface IProps {
  readonly FILEPART_CODE_PREFIX?: string
  readonly FILEPART_MAX_SIZE?: number
  readonly HIGH_SECURITY?: boolean
  readonly root: string
  readonly reporter: IReporter
  readonly encode?: (virtualPath: string) => NodeJS.ReadWriteStream
  readonly decode?: (virtualPath: string) => NodeJS.ReadWriteStream
}

export class LocalVirtualFileSystem extends VirtualFileSystem implements IVirtualFileSystem {
  constructor(props: IProps) {
    const {
      FILEPART_CODE_PREFIX = DEFAULT_FILEPART_CODE_PREFIX,
      FILEPART_MAX_SIZE = Number.MAX_SAFE_INTEGER,
      HIGH_SECURITY = false,
      root,
      reporter,
      encode,
      decode,
    } = props
    const pathResolver = new VfsPathResolver({
      FILEPART_CODE_PREFIX,
      physicalRoot: root,
      virtualRoot: root,
    })

    super({
      FILEPART_CODE_PREFIX,
      FILEPART_MAX_SIZE,
      HIGH_SECURITY,
      reporter,
      pathResolver,
      encode,
      decode,
    })
  }
}
