import type { IReporter } from '@guanghechen/reporter.types'
import type { IVirtualFileSystem } from '@guanghechen/vfs.types'
import { VirtualFileSystem } from './filesystem'
import { VfsPathResolver } from './path'

interface IProps {
  root: string
  reporter: IReporter
  encode?: (content: Uint8Array, virtualPath: string) => Promise<Uint8Array>
  decode?: (content: Uint8Array, virtualPath: string) => Promise<Uint8Array>
}

export class LocalVirtualFileSystem extends VirtualFileSystem implements IVirtualFileSystem {
  constructor(props: IProps) {
    const { root, reporter, encode, decode } = props
    const pathResolver = new VfsPathResolver({ physicalRoot: root, virtualRoot: root })
    super({ reporter, pathResolver, encode, decode })
  }
}
