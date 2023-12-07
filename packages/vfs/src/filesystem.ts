import { BatchDisposable, Disposable } from '@guanghechen/disposable'
import type { IDisposable } from '@guanghechen/disposable'
import type { IWorkspacePathResolver } from '@guanghechen/path.types'
import type { IReporter } from '@guanghechen/reporter.types'
import { VfsErrorCode, VfsFileType, isVfsOperationSucceed } from '@guanghechen/vfs.types'
import type {
  IVfsFileStat,
  IVfsFileWatchOptions,
  IVfsPathResolver,
  IVirtualFileSystem,
} from '@guanghechen/vfs.types'
import chokidar from 'chokidar'
import type { ReadStream, WriteStream } from 'fs'
import { createReadStream, createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'

interface IProps {
  reporter: IReporter
  pathResolver: IVfsPathResolver
  encode?: (content: Uint8Array, virtualPath: string) => Promise<Uint8Array>
  decode?: (content: Uint8Array, virtualPath: string) => Promise<Uint8Array>
}

const clazz: string = 'VirtualFileSystem'

export class VirtualFileSystem extends BatchDisposable implements IVirtualFileSystem {
  protected readonly pathResolver: IVfsPathResolver
  protected readonly reporter: IReporter
  protected readonly encode: (content: Uint8Array, virtualPath: string) => Promise<Uint8Array>
  protected readonly decode: (content: Uint8Array, virtualPath: string) => Promise<Uint8Array>

  constructor(props: IProps) {
    const { pathResolver, reporter, encode, decode } = props
    super()

    this.pathResolver = pathResolver
    this.reporter = reporter
    this.encode = encode ?? (async content => content)
    this.decode = decode ?? (async content => content)
  }

  // TODO: remove `workspacePathResolver`.
  public get workspacePathResolver(): IWorkspacePathResolver {
    throw new Error('workspacePathResolver is deprecated')
  }

  public async copy(
    sourceVirtualPath: string,
    targetVirtualPath: string,
    overwrite: boolean,
    recursive: boolean,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `sourceVirtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | VfsErrorCode.TARGET_PARENT_NOT_FOUND // When parent of `targetVirtualPath` doesn't exist.
    | VfsErrorCode.TARGET_PARENT_NOT_DIRECTORY // When parent of `targetVirtualPath` is not a directory.
    | VfsErrorCode.TARGET_EXIST // When `targetVirtualPath` exists and when the `overwrite` is not `true`.
    | VfsErrorCode.TARGET_IS_DIRECTORY // When `sourceVirtualPath` is not a directory but `targetVirtualPath` is a directory.
    | VfsErrorCode.TARGET_NOT_DIRECTORY // When `sourceVirtualPath` is a directory but `targetVirtualPath` is not a directory.
    | VfsErrorCode.TARGET_NO_PERMISSION // When permission aren't sufficient.
    | void // When the operation is executed successfully.
  > {
    const isSourceExist: boolean = await this.isExist(sourceVirtualPath)
    if (!isSourceExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const { pathResolver } = this
    const targetVirtualParentPath: string = pathResolver.dirVirtualPath(targetVirtualPath)
    const targetParentStat: VfsErrorCode | IVfsFileStat = await this.stat(targetVirtualParentPath)
    if (!isVfsOperationSucceed(targetParentStat)) {
      if (targetParentStat === VfsErrorCode.SOURCE_NOT_FOUND) {
        return VfsErrorCode.TARGET_PARENT_NOT_FOUND
      }
      if (targetParentStat === VfsErrorCode.SOURCE_NO_PERMISSION) {
        return VfsErrorCode.TARGET_NO_PERMISSION
      }
      return VfsErrorCode.TARGET_NO_PERMISSION
    }
    if (targetParentStat.type !== VfsFileType.DIRECTORY) {
      return VfsErrorCode.TARGET_PARENT_NOT_DIRECTORY
    }

    const sourcePhysicalPath: string = pathResolver.locatePhysicalPath(sourceVirtualPath)
    const targetPhysicalPath: string = pathResolver.locatePhysicalPath(targetVirtualPath)
    const isTargetExist: boolean = await this.isExist(targetVirtualPath)
    if (isTargetExist) {
      if (!overwrite) return VfsErrorCode.TARGET_EXIST

      const sourceStat: VfsErrorCode | IVfsFileStat = await this.stat(sourceVirtualPath)
      const targetStat: VfsErrorCode | IVfsFileStat = await this.stat(targetVirtualPath)
      if (!isVfsOperationSucceed(sourceStat)) return VfsErrorCode.SOURCE_NO_PERMISSION
      if (!isVfsOperationSucceed(targetStat)) return VfsErrorCode.TARGET_NO_PERMISSION
      if (sourceStat.type !== targetStat.type) {
        if (sourceStat.type === VfsFileType.DIRECTORY) return VfsErrorCode.TARGET_NOT_DIRECTORY
        if (targetStat.type === VfsFileType.DIRECTORY) return VfsErrorCode.TARGET_IS_DIRECTORY
        return VfsErrorCode.TARGET_EXIST
      }
    }

    try {
      await fs.cp(sourcePhysicalPath, targetPhysicalPath, { recursive, force: overwrite })
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.copy] failed.', clazz, {
        sourceVirtualPath,
        targetVirtualPath,
        sourcePhysicalPath,
        targetPhysicalPath,
        overwrite,
        recursive,
      })
      return VfsErrorCode.TARGET_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async createReadStream(
    virtualPath: string,
    options?: BufferEncoding | undefined,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND
    | VfsErrorCode.SOURCE_IS_DIRECTORY
    | VfsErrorCode.SOURCE_NO_PERMISSION
    | ReadStream
  > {
    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    if (!isVfsOperationSucceed(stat)) return stat
    if (stat.type === VfsFileType.DIRECTORY) return VfsErrorCode.SOURCE_IS_DIRECTORY

    const { pathResolver } = this
    const physicalPath: string = pathResolver.locatePhysicalPath(virtualPath)
    try {
      const stream: ReadStream = createReadStream(physicalPath, options)
      return stream
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.createReadStream] failed.', clazz, {
        virtualPath,
        physicalPath,
        options,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async createWriteStream(
    virtualPath: string,
    options?: BufferEncoding | undefined,
  ): Promise<
    | VfsErrorCode.SOURCE_PARENT_NOT_FOUND
    | VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY
    | VfsErrorCode.SOURCE_NO_PERMISSION
    | WriteStream
  > {
    const { pathResolver } = this
    const virtualParentPath: string = pathResolver.dirVirtualPath(virtualPath)
    const isParentExist: boolean = await this.isExist(virtualParentPath)
    if (!isParentExist) return VfsErrorCode.SOURCE_PARENT_NOT_FOUND

    const parentStat: VfsErrorCode | IVfsFileStat = await this.stat(virtualParentPath)
    if (!isVfsOperationSucceed(parentStat)) return VfsErrorCode.SOURCE_NO_PERMISSION
    if (parentStat.type !== VfsFileType.DIRECTORY) return VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY

    try {
      return createWriteStream(virtualPath, options)
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.createWriteStream] failed.', clazz, {
        virtualPath,
        options,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async isExist(virtualPath: string): Promise<boolean> {
    return this.pathResolver.isVirtualPathExist(virtualPath)
  }

  public async isFile(virtualPath: string): Promise<boolean> {
    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    return isVfsOperationSucceed(stat) && stat.type === VfsFileType.FILE
  }

  public async isDirectory(virtualPath: string): Promise<boolean> {
    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    return isVfsOperationSucceed(stat) && stat.type === VfsFileType.DIRECTORY
  }

  public async mkdir(
    virtualPath: string,
    recursive: boolean,
  ): Promise<
    | VfsErrorCode.SOURCE_PARENT_NOT_FOUND // When the parent of `virtualPath` doesn't exist and `recursive` is false.
    | VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY // When the parent of `virtualPath` is a directory.
    | VfsErrorCode.SOURCE_EXIST // When `virtualPath` already exists.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  > {
    const isExist: boolean = await this.isExist(virtualPath)
    if (isExist) return VfsErrorCode.SOURCE_EXIST

    const { pathResolver } = this
    const virtualParentPath: string = pathResolver.dirVirtualPath(virtualPath)
    const isParentExist: boolean = await this.isExist(virtualParentPath)
    if (!isParentExist && !recursive) return VfsErrorCode.SOURCE_PARENT_NOT_FOUND

    const physicalPath: string = pathResolver.locatePhysicalPath(virtualPath)
    if (isParentExist) {
      const parentStat: VfsErrorCode | IVfsFileStat = await this.stat(virtualParentPath)
      if (!isVfsOperationSucceed(parentStat)) return VfsErrorCode.SOURCE_NO_PERMISSION
      if (parentStat.type !== VfsFileType.DIRECTORY) return VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY
    }

    try {
      await fs.mkdir(physicalPath, { recursive })
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.mkdir] failed.', clazz, {
        virtualPath,
        physicalPath,
        recursive,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async read(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When the `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_IS_DIRECTORY // When the `virtualPath` is a directory.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | Uint8Array // File content. // When the operation is executed successfully.
  > {
    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    if (!isVfsOperationSucceed(stat)) return stat
    if (stat.type === VfsFileType.DIRECTORY) return VfsErrorCode.SOURCE_IS_DIRECTORY

    const { pathResolver } = this
    const physicalPath: string = pathResolver.locatePhysicalPath(virtualPath)

    try {
      const content: Buffer = await fs.readFile(physicalPath)
      const decodedContent: Uint8Array = await this.decode(Uint8Array.from(content), virtualPath)
      return decodedContent
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.read] failed.', clazz, {
        virtualPath,
        physicalPath,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async readdir(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When the  `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_NOT_DIRECTORY // When the `virtualPath` is not a directory.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | string[] // filenames under the dir. // When the operation is executed successfully.
  > {
    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    if (!isVfsOperationSucceed(stat)) return stat
    if (stat.type !== VfsFileType.DIRECTORY) return VfsErrorCode.SOURCE_NOT_DIRECTORY

    const physicalPath: string = this.pathResolver.locatePhysicalPath(virtualPath)
    const filenames: string[] = await fs.readdir(physicalPath)
    return filenames
  }

  public async remove(
    virtualPath: string,
    recursive: boolean,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  > {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const { pathResolver } = this
    const physicalPath: string = pathResolver.locatePhysicalPath(virtualPath)
    try {
      await fs.rm(physicalPath, { recursive })
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.remove] failed.', clazz, {
        virtualPath,
        physicalPath,
        recursive,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async rename(
    sourceVirtualPath: string,
    targetVirtualPath: string,
    overwrite: boolean,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `sourceVirtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | VfsErrorCode.TARGET_PARENT_NOT_FOUND // When parent of `targetVirtualPath` doesn't exist.
    | VfsErrorCode.TARGET_PARENT_NOT_DIRECTORY // When parent of `targetVirtualPath` is not a directory.
    | VfsErrorCode.TARGET_EXIST // When `targetVirtualPath` exists and when the `overwrite` is not `true`.
    | VfsErrorCode.TARGET_IS_DIRECTORY // When `sourceVirtualPath` is not a directory but `targetVirtualPath` is a directory.
    | VfsErrorCode.TARGET_NOT_DIRECTORY // When `sourceVirtualPath` is a directory but `targetVirtualPath` is not a directory.
    | VfsErrorCode.TARGET_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  > {
    const isSourceExist: boolean = await this.isExist(sourceVirtualPath)
    if (!isSourceExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const { pathResolver } = this
    const targetVirtualParentPath: string = pathResolver.dirVirtualPath(targetVirtualPath)
    const isTargetParentExist: boolean = await this.isExist(targetVirtualParentPath)
    if (!isTargetParentExist) return VfsErrorCode.TARGET_PARENT_NOT_FOUND

    const targetVirtualParentStat: VfsErrorCode | IVfsFileStat =
      await this.stat(targetVirtualParentPath)
    if (
      !isVfsOperationSucceed(targetVirtualParentStat) ||
      targetVirtualParentStat.type !== VfsFileType.DIRECTORY
    ) {
      return VfsErrorCode.TARGET_PARENT_NOT_DIRECTORY
    }

    const sourcePhysicalPath: string = pathResolver.locatePhysicalPath(sourceVirtualPath)
    const targetPhysicalPath: string = pathResolver.locatePhysicalPath(targetVirtualPath)
    const isTargetExist: boolean = await this.isExist(targetVirtualPath)
    if (isTargetExist) {
      if (!overwrite) return VfsErrorCode.TARGET_EXIST
      const sourceStat: VfsErrorCode | IVfsFileStat = await this.stat(sourceVirtualPath)
      const targetStat: VfsErrorCode | IVfsFileStat = await this.stat(targetVirtualPath)
      if (!isVfsOperationSucceed(sourceStat)) return VfsErrorCode.SOURCE_NO_PERMISSION
      if (!isVfsOperationSucceed(targetStat)) return VfsErrorCode.TARGET_NO_PERMISSION
      if (sourceStat.type !== targetStat.type) {
        if (sourceStat.type === VfsFileType.DIRECTORY) return VfsErrorCode.TARGET_NOT_DIRECTORY
        if (targetStat.type === VfsFileType.DIRECTORY) return VfsErrorCode.TARGET_IS_DIRECTORY
        return VfsErrorCode.TARGET_EXIST
      }
    }

    try {
      await fs.rename(sourcePhysicalPath, targetPhysicalPath)
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.rename] failed.', clazz, {
        sourceVirtualPath,
        targetVirtualPath,
        sourcePhysicalPath,
        targetPhysicalPath,
        overwrite,
      })
      return VfsErrorCode.TARGET_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async stat(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | IVfsFileStat // File metadata .// When the operation is executed successfully.
  > {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const { pathResolver } = this
    const physicalPath: string = pathResolver.locatePhysicalPath(virtualPath)
    try {
      const stat = await fs.stat(physicalPath)
      const type: VfsFileType = stat.isFile()
        ? VfsFileType.FILE
        : stat.isDirectory()
          ? VfsFileType.DIRECTORY
          : stat.isSymbolicLink()
            ? VfsFileType.SYMBOLIC
            : VfsFileType.UNKNOWN
      return {
        type,
        ctime: stat.ctimeMs,
        mtime: stat.mtimeMs,
        size: stat.size,
        readonly: false,
      }
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.stat] failed.', clazz, {
        virtualPath,
        physicalPath,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore end */
  }

  public watch(
    virtualPath: string,
    options: IVfsFileWatchOptions,
  ):
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | IDisposable /* Dispose the watcher. // When the operation is executed successfully. */ {
    const { pathResolver } = this
    const isExist: boolean = pathResolver.isVirtualPathExist(virtualPath)
    if (!isExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const physicalPath: string = pathResolver.locatePhysicalPath(virtualPath)
    const { recursive, excludes, onChanged, onCreated, onDeleted } = options
    const watcher = chokidar.watch(physicalPath, {
      cwd: pathResolver.physicalRoot,
      ignoreInitial: true,
      depth: recursive ? undefined : 1,
      ignored: excludes.slice(),
    })

    watcher
      .on('change', fp => {
        const physicalPath: string = pathResolver.joinPhysicalPath(pathResolver.physicalRoot, fp)
        const virtualPath: string = pathResolver.locateVirtualPath(physicalPath)
        onChanged(virtualPath)
      }) //
      .on('add', fp => {
        const physicalPath: string = pathResolver.joinPhysicalPath(pathResolver.physicalRoot, fp)
        const virtualPath: string = pathResolver.locateVirtualPath(physicalPath)
        onCreated(virtualPath)
      })
      .on('unlink', fp => {
        const physicalPath: string = pathResolver.joinPhysicalPath(pathResolver.physicalRoot, fp)
        const virtualPath: string = pathResolver.locateVirtualPath(physicalPath)
        onDeleted(virtualPath)
      })

    const disposable: IDisposable = Disposable.fromCallback((): void => {
      watcher.unwatch(physicalPath)
      void watcher.close()
    })
    this.registerDisposable(disposable)
    return disposable
  }

  public async write(
    virtualPath: string,
    content: Uint8Array,
    create: boolean,
    overwrite: boolean,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When the `virtualPath` doesn't exist and `create` is not `true`.
    | VfsErrorCode.SOURCE_PARENT_NOT_FOUND // When the parent of `virtualPath` doesn't exist and `create` is `true`.
    | VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY // When the parent of `virtualPath` is not a directory
    | VfsErrorCode.SOURCE_EXIST // When the `virtualPath` already exists, `create` is set but `overwrite` is not `true`.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  > {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist && !create) return VfsErrorCode.SOURCE_NOT_FOUND
    if (isExist && create && !overwrite) return VfsErrorCode.SOURCE_EXIST

    const { pathResolver } = this
    const virtualParentPath: string = pathResolver.dirVirtualPath(virtualPath)
    const isParentExist: boolean = await this.isExist(virtualParentPath)
    if (!isParentExist && create) return VfsErrorCode.SOURCE_PARENT_NOT_FOUND

    const physicalPath: string = pathResolver.locatePhysicalPath(virtualPath)
    if (isParentExist) {
      const parentStat: VfsErrorCode | IVfsFileStat = await this.stat(virtualParentPath)
      if (!isVfsOperationSucceed(parentStat)) return VfsErrorCode.SOURCE_NO_PERMISSION
      if (parentStat.type !== VfsFileType.DIRECTORY) return VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY
    }

    try {
      const encodedContent: Uint8Array = await this.encode(content, virtualPath)
      await fs.writeFile(physicalPath, encodedContent)
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.write] failed.', clazz, {
        virtualPath,
        physicalPath,
        create,
        overwrite,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }
}
