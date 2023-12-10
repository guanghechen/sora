import type { IWorkspacePathResolver } from '@guanghechen/path'
import {
  WorkspacePathResolver,
  pathResolver as physicalPathResolver,
  urlPathResolver as virtualPathResolver,
} from '@guanghechen/path'
import type { IVfsPathResolver } from '@guanghechen/vfs.types'
import { existsSync, readdirSync, statSync } from 'node:fs'

interface IProps {
  readonly FILEPART_CODE_PREFIX: string
  readonly physicalRoot: string
  readonly virtualRoot: string
}

const clazz: string = 'VfsPathResolver'

export class VfsPathResolver implements IVfsPathResolver {
  protected readonly FILEPART_CODE_PREFIX: string
  protected readonly physical: IWorkspacePathResolver
  protected readonly virtual: IWorkspacePathResolver

  constructor(props: IProps) {
    const { FILEPART_CODE_PREFIX } = props
    const physicalRoot: string = physicalPathResolver.normalize(props.physicalRoot)
    const virtualRoot: string = virtualPathResolver.normalize(props.virtualRoot)
    const physical = new WorkspacePathResolver(physicalRoot, physicalPathResolver)
    const virtual = new WorkspacePathResolver(virtualRoot, virtualPathResolver)

    this.FILEPART_CODE_PREFIX = FILEPART_CODE_PREFIX
    this.physical = physical
    this.virtual = virtual
  }

  public get physicalRoot(): string {
    return this.physical.root
  }

  public get virtualRoot(): string {
    return this.virtual.root
  }

  public dirPhysicalPath(physicalPath: string): string {
    const absolutePhysicalPath: string = this.physical.resolve(physicalPath)
    const physicalParentPath: string = this.physical.pathResolver.dirname(absolutePhysicalPath)
    return physicalParentPath
  }

  public dirVirtualPath(virtualPath: string): string {
    const absoluteVirtualPath: string = this.virtual.resolve(virtualPath)
    const virtualParentPath: string = this.virtual.pathResolver.dirname(absoluteVirtualPath)
    return virtualParentPath
  }

  public isPhysicalPath(filepath: string): boolean {
    return this.physical.isSafePath(filepath)
  }

  public isPhysicalPathExist(physicalPath: string): boolean {
    return existsSync(physicalPath)
  }

  public isVirtualPath(filepath: string): boolean {
    return this.virtual.isSafePath(filepath)
  }

  public isVirtualPathExist(virtualPath: string): boolean {
    const { partTotal } = this.locatePhysicalPath(virtualPath)
    return partTotal > 0
  }

  public joinPhysicalPath(physicalPath: string, ...pathPieces: string[]): string {
    return this.physical.pathResolver.join(physicalPath, ...pathPieces)
  }

  public joinVirtualPath(virtualPath: string, ...pathPieces: string[]): string {
    return this.virtual.pathResolver.join(virtualPath, ...pathPieces)
  }

  public locatePhysicalPath(virtualPath: string): { physicalPath: string; partTotal: number } {
    if (!this.isVirtualPath(virtualPath)) {
      throw new Error(`[${clazz}.locatePhysicalPath] bad virtual path. Received: ${virtualPath}`)
    }
    const relativePath: string = this.virtual.relative(virtualPath)
    const physicalPath: string = this.physical.resolve(relativePath)
    if (this.isPhysicalPathExist(physicalPath)) return { physicalPath, partTotal: 1 }

    const dirname: string = this.physical.pathResolver.dirname(physicalPath)
    if (!this.isPhysicalPathExist(dirname)) return { physicalPath, partTotal: 0 }
    if (!statSync(dirname).isDirectory()) return { physicalPath, partTotal: 0 }

    const filenames: string[] = readdirSync(dirname)
    const filePartNamePrefix: string =
      this.physical.pathResolver.basename(physicalPath) + this.FILEPART_CODE_PREFIX

    let partTotal: number = 0
    for (const filename of filenames) {
      if (
        filename.startsWith(filePartNamePrefix) &&
        /^\d+$/.test(filename.slice(filePartNamePrefix.length))
      ) {
        partTotal += 1
      }
    }
    return { physicalPath, partTotal }
  }

  public locateVirtualPath(physicalPath: string): string {
    if (!this.isPhysicalPath(physicalPath)) {
      throw new Error(`[${clazz}.locateVirtualPath] bad physical path. Received: ${physicalPath}`)
    }
    const relativePath: string = this.physical.relative(physicalPath)
    const virtualPath: string = this.virtual.resolve(relativePath)
    return virtualPath
  }

  public normalizePhysicalPath(physicalPath: string): string {
    if (!this.isPhysicalPath(physicalPath)) {
      throw new Error(
        `[${clazz}.normalizePhysicalPath] bad physical path. Received: ${physicalPath}`,
      )
    }
    return this.physical.pathResolver.normalize(physicalPath)
  }

  public normalizeVirtualPath(virtualPath: string): string {
    if (!this.isVirtualPath(virtualPath)) {
      throw new Error(`[${clazz}.joinVirtualPath] bad virtual path. Received: ${virtualPath}`)
    }
    return this.virtual.pathResolver.normalize(virtualPath)
  }
}
