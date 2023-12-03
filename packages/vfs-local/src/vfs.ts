import { BatchDisposable, Disposable, type IDisposable } from '@guanghechen/disposable'
import { WorkspacePathResolver, pathResolver as physicalPathResolver } from '@guanghechen/path'
import type { IWorkspacePathResolver } from '@guanghechen/path.types'
import type { IReporter } from '@guanghechen/reporter.types'
import { VfsErrorCode, VfsFileType, isVfsOperationSucceed } from '@guanghechen/vfs.types'
import type { IVfsFileStat, IVfsFileWatchOptions, IVirtualFileSystem } from '@guanghechen/vfs.types'
import chokidar from 'chokidar'
import type { ReadStream, WriteStream } from 'fs'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

interface IProps {
  root: string
  reporter: IReporter
}

const clazz: string = 'LocalVirtualFileSystem'

export class LocalVirtualFileSystem extends BatchDisposable implements IVirtualFileSystem {
  public readonly workspacePathResolver: IWorkspacePathResolver
  protected readonly reporter: IReporter

  constructor(props: IProps) {
    const { root, reporter } = props
    const workspacePathResolver: IWorkspacePathResolver = new WorkspacePathResolver(
      root,
      physicalPathResolver,
    )

    super()
    this.reporter = reporter
    this.workspacePathResolver = workspacePathResolver
  }

  public async copy(
    sourceVirtualPath: string,
    targetVirtualPath: string,
    overwrite: boolean,
    recursive: boolean,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `sourceVirtualPath` doesn't exist.
    | VfsErrorCode.PARENT_TARGET_NOT_FOUND // When parent of `targetVirtualPath` doesn't exist.
    | VfsErrorCode.PARENT_TARGET_NOT_DIRECTORY // When parent of `targetVirtualPath` is not a directory.
    | VfsErrorCode.TARGET_EXIST // When `targetVirtualPath` exists and when the `overwrite` is not `true`.
    | VfsErrorCode.TARGET_IS_DIRECTORY // When `sourceVirtualPath` is not a directory but `targetVirtualPath` is a directory.
    | VfsErrorCode.TARGET_NOT_DIRECTORY // When `sourceVirtualPath` is a directory but `targetVirtualPath` is not a directory.
    | VfsErrorCode.TARGET_NO_PERMISSION // When permission aren't sufficient.
    | void // When the operation is executed successfully.
  > {
    const isSourceExist: boolean = await this.isExist(sourceVirtualPath)
    if (!isSourceExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const isTargetParentExist: boolean = await this.isExist(path.dirname(targetVirtualPath))
    if (!isTargetParentExist) return VfsErrorCode.PARENT_TARGET_NOT_FOUND

    const { workspacePathResolver } = this
    const physicalSourcePath: string = workspacePathResolver.resolve(sourceVirtualPath)
    const physicalTargetPath: string = workspacePathResolver.resolve(targetVirtualPath)
    const physicalTargetParentPath: string =
      workspacePathResolver.pathResolver.dirname(physicalTargetPath)

    const parentStat = await fs.stat(physicalTargetParentPath)
    if (!parentStat.isDirectory()) return VfsErrorCode.PARENT_TARGET_NOT_DIRECTORY

    const isTargetExist: boolean = await this.isExist(targetVirtualPath)
    if (isTargetExist) {
      if (!overwrite) return VfsErrorCode.TARGET_EXIST

      const sourceStat = await fs.stat(physicalSourcePath)
      const targetStat = await fs.stat(physicalTargetPath)
      if (!sourceStat.isDirectory() && targetStat.isDirectory()) {
        return VfsErrorCode.TARGET_IS_DIRECTORY
      }
      if (sourceStat.isDirectory() && !targetStat.isDirectory()) {
        return VfsErrorCode.TARGET_NOT_DIRECTORY
      }
    }

    try {
      await fs.cp(physicalSourcePath, physicalTargetPath, { recursive, force: overwrite })
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.copy] failed.', clazz, {
        source: sourceVirtualPath,
        target: targetVirtualPath,
        physicalSourcePath,
        physicalTargetPath,
      })
      return VfsErrorCode.TARGET_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async createReadStream(
    virtualPath: string,
    options?: BufferEncoding | undefined,
  ): Promise<VfsErrorCode.SOURCE_NOT_FOUND | VfsErrorCode.SOURCE_IS_DIRECTORY | ReadStream> {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const stat = await this.stat(virtualPath)
    if (!isVfsOperationSucceed(stat)) return stat
    if (stat.type === VfsFileType.DIRECTORY) throw VfsErrorCode.SOURCE_IS_DIRECTORY

    const { workspacePathResolver } = this
    const physicalPath: string = workspacePathResolver.resolve(virtualPath)
    const stream: ReadStream = createReadStream(physicalPath, options)
    return stream
  }

  public async createWriteStream(
    virtualPath: string,
    options?: BufferEncoding | undefined,
  ): Promise<
    VfsErrorCode.PARENT_SOURCE_NOT_FOUND | VfsErrorCode.PARENT_SOURCE_NOT_DIRECTORY | WriteStream
  > {
    return createWriteStream(virtualPath, options)
  }

  public async isExist(virtualPath: string): Promise<boolean> {
    const physicalPath: string = this.workspacePathResolver.resolve(virtualPath)
    return existsSync(physicalPath)
  }

  public async isFile(virtualPath: string): Promise<boolean> {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist) return false

    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    return isVfsOperationSucceed(stat) && stat.type === VfsFileType.FILE
  }

  public async isDirectory(virtualPath: string): Promise<boolean> {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist) return false

    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    return isVfsOperationSucceed(stat) && stat.type === VfsFileType.DIRECTORY
  }

  public async mkdir(
    virtualPath: string,
    recursive: boolean,
  ): Promise<
    | VfsErrorCode.PARENT_SOURCE_NOT_FOUND // When the parent of `virtualPath` doesn't exist and `recursive` is false.
    | VfsErrorCode.PARENT_SOURCE_NOT_DIRECTORY // When the parent of `virtualPath` is a directory.
    | VfsErrorCode.SOURCE_EXIST // When `virtualPath` already exists.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  > {
    const isParentExist: boolean = await this.isExist(path.dirname(virtualPath))
    if (!isParentExist && !recursive) return VfsErrorCode.PARENT_SOURCE_NOT_FOUND

    const isExist: boolean = await this.isExist(virtualPath)
    if (isExist) return VfsErrorCode.SOURCE_EXIST

    const { workspacePathResolver, reporter } = this
    const physicalPath: string = workspacePathResolver.resolve(virtualPath)
    const physicalParentPath: string = workspacePathResolver.pathResolver.dirname(virtualPath)

    if (isParentExist) {
      const parentStat = await fs.stat(physicalParentPath)
      if (!parentStat.isDirectory()) return VfsErrorCode.PARENT_SOURCE_NOT_DIRECTORY
    }

    try {
      await fs.mkdir(physicalPath, { recursive })
    } catch (error) {
      /* c8 ignore start */
      reporter.error('[{}.mkdir] failed.', clazz, {
        virtualPath: virtualPath,
        physicalPath,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async read(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When the `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_IS_DIRECTORY // When the `virtualPath` is a directory.
    | Uint8Array // File content. // When the operation is executed successfully.
  > {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const { workspacePathResolver } = this
    const physicalPath: string = workspacePathResolver.resolve(virtualPath)
    const stat = await fs.stat(physicalPath)
    if (stat.isDirectory()) throw VfsErrorCode.SOURCE_IS_DIRECTORY

    const content: Buffer = await fs.readFile(physicalPath)
    return Uint8Array.from(content)
  }

  public async readdir(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When the  `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_NOT_DIRECTORY // When the `virtualPath` is not a directory.
    | string[] // filenames under the dir. // When the operation is executed successfully.
  > {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const { workspacePathResolver } = this
    const physicalPath: string = workspacePathResolver.resolve(virtualPath)
    const stat = await fs.stat(physicalPath)
    if (!stat.isDirectory()) return VfsErrorCode.SOURCE_NOT_DIRECTORY

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

    const { workspacePathResolver, reporter } = this
    const physicalPath: string = workspacePathResolver.resolve(virtualPath)
    try {
      await fs.rm(physicalPath, { recursive })
    } catch (error) {
      /* c8 ignore start */
      reporter.error('[{}.remove] failed.', clazz, {
        virtualPath: virtualPath,
        physicalPath,
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
    | VfsErrorCode.PARENT_TARGET_NOT_FOUND // When parent of `targetVirtualPath` doesn't exist.
    | VfsErrorCode.PARENT_TARGET_NOT_DIRECTORY // When parent of `targetVirtualPath` is not a directory.
    | VfsErrorCode.TARGET_EXIST // When `targetVirtualPath` exists and when the `overwrite` is not `true`.
    | VfsErrorCode.TARGET_IS_DIRECTORY // When `sourceVirtualPath` is not a directory but `targetVirtualPath` is a directory.
    | VfsErrorCode.TARGET_NOT_DIRECTORY // When `sourceVirtualPath` is a directory but `targetVirtualPath` is not a directory.
    | VfsErrorCode.TARGET_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  > {
    const isSourceExist: boolean = await this.isExist(sourceVirtualPath)
    if (!isSourceExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const isTargetParentExist: boolean = await this.isExist(path.dirname(targetVirtualPath))
    if (!isTargetParentExist) return VfsErrorCode.PARENT_TARGET_NOT_FOUND

    const { workspacePathResolver } = this
    const sourcePhysicalPath: string = workspacePathResolver.resolve(sourceVirtualPath)
    const targetPhysicalPath: string = workspacePathResolver.resolve(targetVirtualPath)
    const targetParentPhysicalPath: string =
      workspacePathResolver.pathResolver.dirname(targetPhysicalPath)
    const parentStat = await fs.stat(targetParentPhysicalPath)
    if (!parentStat.isDirectory()) return VfsErrorCode.PARENT_TARGET_NOT_DIRECTORY

    const isTargetExist: boolean = await this.isExist(targetVirtualPath)
    if (isTargetExist) {
      if (!overwrite) return VfsErrorCode.TARGET_EXIST

      const sourceStat = await fs.stat(sourcePhysicalPath)
      const targetStat = await fs.stat(targetPhysicalPath)
      if (!sourceStat.isDirectory() && targetStat.isDirectory()) {
        return VfsErrorCode.TARGET_IS_DIRECTORY
      }
      if (sourceStat.isDirectory() && !targetStat.isDirectory()) {
        return VfsErrorCode.TARGET_NOT_DIRECTORY
      }
    }

    try {
      await fs.rename(sourcePhysicalPath, targetPhysicalPath)
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.rename] failed.', clazz, {
        source: sourceVirtualPath,
        target: targetVirtualPath,
        physicalSourcePath: sourcePhysicalPath,
        physicalTargetPath: targetPhysicalPath,
      })
      return VfsErrorCode.TARGET_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async stat(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | IVfsFileStat // File metadata .// When the operation is executed successfully.
  > {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const { workspacePathResolver } = this
    const physicalPath: string = workspacePathResolver.resolve(virtualPath)
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
  }

  public watch(
    virtualPath: string,
    options: IVfsFileWatchOptions,
  ):
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | IDisposable /* Dispose the watcher. // When the operation is executed successfully. */ {
    const { workspacePathResolver } = this
    const physicalPath: string = workspacePathResolver.resolve(virtualPath)
    const isExist: boolean = existsSync(physicalPath)
    if (!isExist) return VfsErrorCode.SOURCE_NOT_FOUND

    const { recursive, excludes, onChanged, onCreated, onDeleted } = options
    const watcher = chokidar.watch(physicalPath, {
      cwd: workspacePathResolver.root,
      ignoreInitial: true,
      depth: recursive ? undefined : 1,
      ignored: excludes.slice(),
    })
    watcher
      .on('change', fp => {
        const virtualPath: string = workspacePathResolver.resolve(fp)
        onChanged(virtualPath)
      }) //
      .on('add', fp => {
        const virtualPath: string = workspacePathResolver.resolve(fp)
        onCreated(virtualPath)
      })
      .on('unlink', fp => {
        const virtualPath: string = workspacePathResolver.resolve(fp)
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
    | VfsErrorCode.PARENT_SOURCE_NOT_FOUND // When the parent of `virtualPath` doesn't exist and `create` is `true`.
    | VfsErrorCode.PARENT_SOURCE_NOT_DIRECTORY // When the parent of `virtualPath` is not a directory
    | VfsErrorCode.SOURCE_EXIST // When the `virtualPath` already exists, `create` is set but `overwrite` is not `true`.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  > {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist && !create) return VfsErrorCode.SOURCE_NOT_FOUND

    const isParentExist: boolean = await this.isExist(path.dirname(virtualPath))
    if (!isParentExist && create) return VfsErrorCode.PARENT_SOURCE_NOT_FOUND

    const { workspacePathResolver, reporter } = this
    const physicalPath: string = workspacePathResolver.resolve(virtualPath)
    const physicalParentPath: string = workspacePathResolver.pathResolver.dirname(physicalPath)

    if (isParentExist) {
      const parentStat = await fs.stat(physicalParentPath)
      if (!parentStat.isDirectory()) return VfsErrorCode.PARENT_SOURCE_NOT_DIRECTORY
    }

    if (isExist && create && !overwrite) return VfsErrorCode.SOURCE_EXIST
    try {
      await fs.writeFile(physicalPath, content)
    } catch (error) {
      /* c8 ignore start */
      reporter.error('[{}.write] failed.', clazz, {
        virtualPath: virtualPath,
        physicalPath,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }
}
