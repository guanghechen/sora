import { BatchDisposable, Disposable } from '@guanghechen/disposable'
import type { IDisposable } from '@guanghechen/disposable'
import { calcFilePartNamesByCount } from '@guanghechen/filepart'
import type { IWorkspacePathResolver } from '@guanghechen/path.types'
import type { IReporter } from '@guanghechen/reporter.types'
import { consumeStream, mergeStreams, stream2bytes } from '@guanghechen/stream'
import { VfsErrorCode, VfsFileType, isVfsOperationSucceed } from '@guanghechen/vfs.types'
import type {
  IVfsFileStat,
  IVfsFileWatchOptions,
  IVfsPathResolver,
  IVirtualFileSystem,
} from '@guanghechen/vfs.types'
import chokidar from 'chokidar'
import { createReadStream, createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import { Readable, Writable } from 'node:stream'

interface IProps {
  readonly FILEPART_CODE_PREFIX: string
  readonly FILEPART_MAX_SIZE: number
  readonly HIGH_SECURITY: boolean
  readonly reporter: IReporter
  readonly pathResolver: IVfsPathResolver
  readonly encode?: (virtualPath: string) => NodeJS.ReadWriteStream
  readonly decode?: (virtualPath: string) => NodeJS.ReadWriteStream
}

const clazz: string = 'VirtualFileSystem'

export class VirtualFileSystem extends BatchDisposable implements IVirtualFileSystem {
  public readonly FILEPART_CODE_PREFIX: string
  public readonly FILEPART_MAX_SIZE: number
  public readonly HIGH_SECURITY: boolean

  protected readonly pathResolver: IVfsPathResolver
  protected readonly reporter: IReporter
  protected readonly encode?: (virtualPath: string) => NodeJS.ReadWriteStream
  protected readonly decode?: (virtualPath: string) => NodeJS.ReadWriteStream

  constructor(props: IProps) {
    const {
      FILEPART_CODE_PREFIX,
      FILEPART_MAX_SIZE,
      HIGH_SECURITY,
      pathResolver,
      reporter,
      encode,
      decode,
    } = props
    super()

    this.FILEPART_CODE_PREFIX = FILEPART_CODE_PREFIX
    this.FILEPART_MAX_SIZE = FILEPART_MAX_SIZE
    this.HIGH_SECURITY = HIGH_SECURITY
    this.pathResolver = pathResolver
    this.reporter = reporter
    this.encode = encode
    this.decode = decode
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

    const { physicalPath: baseSourcePhysicalPath, partTotal: sourcePartTotal } =
      pathResolver.locatePhysicalPath(sourceVirtualPath)
    const { physicalPath: baseTargetPhysicalPath, partTotal: targetPartTotal } =
      pathResolver.locatePhysicalPath(targetVirtualPath)

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

      // Since there could be multiple parts of the file, we need to remove all of them before copy.
      if (targetPartTotal > sourcePartTotal) {
        await this.remove(targetVirtualPath, false)
      }
    }

    try {
      for (const partName of calcFilePartNamesByCount(sourcePartTotal, this.FILEPART_CODE_PREFIX)) {
        const src: string = baseSourcePhysicalPath + partName
        const dst: string = baseTargetPhysicalPath + partName
        await fs.cp(src, dst, { recursive, force: overwrite })
      }
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.copy] failed.', clazz, {
        sourceVirtualPath,
        targetVirtualPath,
        baseSourcePhysicalPath,
        baseTargetPhysicalPath,
        sourcePartTotal,
        targetPartTotal,
        overwrite,
        recursive,
      })
      return VfsErrorCode.TARGET_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async createReadStream(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_IS_DIRECTORY // When the `virtualPath` is a directory.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | NodeJS.ReadableStream // When the operation is executed successfully.
  > {
    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    if (!isVfsOperationSucceed(stat)) return stat
    if (stat.type === VfsFileType.DIRECTORY) return VfsErrorCode.SOURCE_IS_DIRECTORY

    const { pathResolver, decode } = this
    const { physicalPath: basicPhysicalPath, partTotal } =
      pathResolver.locatePhysicalPath(virtualPath)
    try {
      const streams: NodeJS.ReadableStream[] = []
      for (const partName of calcFilePartNamesByCount(partTotal, this.FILEPART_CODE_PREFIX)) {
        const physicalPath: string = basicPhysicalPath + partName
        const stream: NodeJS.ReadableStream = createReadStream(physicalPath, undefined)
        streams.push(stream)
      }
      const readable: NodeJS.ReadableStream = mergeStreams(streams)
      return decode ? readable.pipe(decode(virtualPath)) : readable
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.createReadStream] failed.', clazz, {
        virtualPath,
        basicPhysicalPath,
        partTotal,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async createWriteStream(
    virtualPath: string,
    create: boolean,
    overwrite: boolean,
    byteLength: number,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When the `virtualPath` doesn't exist and `create` is not `true`.
    | VfsErrorCode.SOURCE_PARENT_NOT_FOUND // When the parent of `virtualPath` doesn't exist and `create` is `true`.
    | VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY // When the parent of `virtualPath` is not a directory
    | VfsErrorCode.SOURCE_EXIST // When the `virtualPath` already exists, `create` is set but `overwrite` is not `true`.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | NodeJS.WritableStream // When the operation is executed successfully.
  > {
    const isExist: boolean = await this.isExist(virtualPath)
    if (!isExist && !create) return VfsErrorCode.SOURCE_NOT_FOUND
    if (isExist && create && !overwrite) return VfsErrorCode.SOURCE_EXIST

    const { FILEPART_CODE_PREFIX, FILEPART_MAX_SIZE, pathResolver, encode } = this
    const virtualParentPath: string = pathResolver.dirVirtualPath(virtualPath)
    const parentStat: VfsErrorCode | IVfsFileStat = await this.stat(virtualParentPath)
    const isParentExist: boolean = isVfsOperationSucceed(parentStat)
    if (!isParentExist && create) return VfsErrorCode.SOURCE_PARENT_NOT_FOUND
    if (isVfsOperationSucceed(parentStat) && parentStat.type !== VfsFileType.DIRECTORY) {
      return VfsErrorCode.SOURCE_PARENT_NOT_DIRECTORY
    }

    const { physicalPath: basePhysicalPath, partTotal } =
      pathResolver.locatePhysicalPath(virtualPath)
    const expectPartTotal: number = Math.ceil(byteLength / FILEPART_MAX_SIZE)

    try {
      // pre-process
      if (!isParentExist) {
        const physicalParentPath: string = pathResolver.dirPhysicalPath(basePhysicalPath)
        await fs.mkdir(physicalParentPath, { recursive: true })
      } else {
        if (partTotal > expectPartTotal) {
          await this.remove(virtualPath, false)
        }
      }

      const partNames: string[] = Array.from(
        calcFilePartNamesByCount(expectPartTotal, FILEPART_CODE_PREFIX),
      )

      let curPartIdx = -1
      let curPartSize = 0
      let curPartWritable: NodeJS.WritableStream | undefined
      const createAndSetPartWritable = (): void => {
        curPartIdx += 1
        curPartSize = 0
        const partName: string = partNames[curPartIdx]
        curPartWritable = createWriteStream(basePhysicalPath + partName)
      }
      const write = async (buffer: Buffer, start: number): Promise<void> => {
        if (curPartWritable === undefined || curPartSize === FILEPART_MAX_SIZE) {
          createAndSetPartWritable()
        }

        const remain: number = FILEPART_MAX_SIZE - curPartSize
        const end: number = Math.min(start + remain, buffer.byteLength)
        const chunk: Uint8Array = Uint8Array.from(buffer.subarray(start, end))

        curPartSize += end - start
        await new Promise<void>((resolve, reject) =>
          curPartWritable!.write(chunk, err => {
            if (err) reject(err)
            else resolve()
          }),
        )
        if (end < buffer.byteLength) await write(buffer, end)
      }

      const writable: NodeJS.WritableStream = new Writable({
        write(chunk: string | Buffer, encoding, callback) {
          const buffer: Buffer = typeof chunk === 'string' ? Buffer.from(chunk, encoding) : chunk
          void write(buffer, 0)
            .then(() => callback())
            .catch(err => callback(err))
        },
      })
      return encode ? encode(virtualPath).pipe(writable) : writable
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.createWriteStream] failed.', clazz, { virtualPath })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }

  public async isDirectory(virtualPath: string): Promise<boolean> {
    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    return isVfsOperationSucceed(stat) && stat.type === VfsFileType.DIRECTORY
  }

  public async isExist(virtualPath: string): Promise<boolean> {
    return this.pathResolver.isVirtualPathExist(virtualPath)
  }

  public async isFile(virtualPath: string): Promise<boolean> {
    const stat: VfsErrorCode | IVfsFileStat = await this.stat(virtualPath)
    return isVfsOperationSucceed(stat) && stat.type === VfsFileType.FILE
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

    const { physicalPath } = pathResolver.locatePhysicalPath(virtualPath)
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
    const streamOrError: NodeJS.ReadableStream | VfsErrorCode =
      await this.createReadStream(virtualPath)
    if (!isVfsOperationSucceed(streamOrError)) return streamOrError

    try {
      const bytes: Uint8Array = await stream2bytes(streamOrError, this.HIGH_SECURITY)
      return bytes
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.read] failed.', clazz, { virtualPath })
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

    const { physicalPath } = this.pathResolver.locatePhysicalPath(virtualPath)
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
    const { physicalPath: basePhysicalPath, partTotal } =
      pathResolver.locatePhysicalPath(virtualPath)
    if (partTotal <= 0) return VfsErrorCode.SOURCE_NOT_FOUND

    try {
      for (const partName of calcFilePartNamesByCount(partTotal, this.FILEPART_CODE_PREFIX)) {
        const physicalPath: string = basePhysicalPath + partName
        await fs.rm(physicalPath, { recursive })
      }
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.remove] failed.', clazz, {
        virtualPath,
        basePhysicalPath,
        partTotal,
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

    const { physicalPath: baseSourcePhysicalPath, partTotal: sourcePartTotal } =
      pathResolver.locatePhysicalPath(sourceVirtualPath)
    const { physicalPath: baseTargetPhysicalPath, partTotal: targetPartTotal } =
      pathResolver.locatePhysicalPath(targetVirtualPath)

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

      // Since there could be multiple parts of the file, we need to remove all of them before copy.
      if (targetPartTotal > sourcePartTotal) {
        await this.remove(targetVirtualPath, false)
      }
    }

    try {
      for (const partName of calcFilePartNamesByCount(sourcePartTotal, this.FILEPART_CODE_PREFIX)) {
        const src: string = baseSourcePhysicalPath + partName
        const dst: string = baseTargetPhysicalPath + partName
        await fs.rename(src, dst)
      }
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.rename] failed.', clazz, {
        sourceVirtualPath,
        targetVirtualPath,
        baseSourcePhysicalPath,
        baseTargetPhysicalPath,
        sourcePartTotal,
        targetPartTotal,
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
    const { physicalPath: basePhysicalPath, partTotal } =
      pathResolver.locatePhysicalPath(virtualPath)
    if (partTotal <= 0) return VfsErrorCode.SOURCE_NOT_FOUND

    try {
      let result: IVfsFileStat | undefined
      for (const partName of calcFilePartNamesByCount(partTotal, this.FILEPART_CODE_PREFIX)) {
        const physicalPath: string = basePhysicalPath + partName
        const stat = await fs.stat(physicalPath)

        const type: VfsFileType = stat.isFile()
          ? VfsFileType.FILE
          : stat.isDirectory()
            ? VfsFileType.DIRECTORY
            : stat.isSymbolicLink()
              ? VfsFileType.SYMBOLIC
              : VfsFileType.UNKNOWN

        if (result === undefined) {
          result = {
            type,
            ctime: stat.ctimeMs,
            mtime: stat.mtimeMs,
            size: stat.size,
            readonly: false,
          }
        } else {
          if (result.type !== type) throw new TypeError(`File types conflict.`)
          if (result.ctime > stat.ctimeMs) result.ctime = stat.ctimeMs
          if (result.mtime < stat.mtimeMs) result.mtime = stat.mtimeMs
          result.size += stat.size
        }
      }
      if (result === undefined) throw new TypeError(`File type conflict.`)
      return result
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.stat] failed.', clazz, {
        virtualPath,
        basePhysicalPath,
        partTotal,
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

    const { physicalPath: basePhysicalPath, partTotal } =
      pathResolver.locatePhysicalPath(virtualPath)
    if (partTotal <= 0) return VfsErrorCode.SOURCE_NOT_FOUND

    const { recursive, excludes, onChanged, onCreated, onDeleted } = options
    const physicalPaths: string[] = Array.from(
      calcFilePartNamesByCount(partTotal, this.FILEPART_CODE_PREFIX),
    ).map(p => basePhysicalPath + p)

    const watcher = chokidar
      .watch(physicalPaths, {
        cwd: pathResolver.physicalRoot,
        ignoreInitial: true,
        depth: recursive ? undefined : 1,
        ignored: excludes.slice(),
      })
      .on('change', () => onChanged(virtualPath))
      .on('add', () => onCreated(virtualPath))
      .on('unlink', () => onDeleted(virtualPath))

    const disposable: IDisposable = Disposable.fromCallback((): void => {
      watcher.unwatch(physicalPaths)
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
    const streamOrError: NodeJS.WritableStream | VfsErrorCode = await this.createWriteStream(
      virtualPath,
      create,
      overwrite,
      content.byteLength,
    )
    if (!isVfsOperationSucceed(streamOrError)) return streamOrError

    try {
      const readable: NodeJS.ReadableStream | VfsErrorCode = new Readable({
        read() {
          this.push(content)
          this.push(null)
        },
      })
      await consumeStream(readable, streamOrError)
    } catch (error) {
      /* c8 ignore start */
      this.reporter.error('[{}.write] failed.', clazz, {
        virtualPath,
        create,
        overwrite,
      })
      return VfsErrorCode.SOURCE_NO_PERMISSION
    }
    /* c8 ignore stop */
  }
}
