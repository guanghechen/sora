import type { IDisposable } from '@guanghechen/disposable.types'
import type { IWorkspacePathResolver } from '@guanghechen/path.types'
import type { ReadStream, WriteStream } from 'node:fs'
import type { VfsErrorCode } from './constant'
import type { IVfsFileStat } from './stat'

export interface IVfsFileWatchOptions {
  recursive: boolean
  excludes: ReadonlyArray<string>
  onChanged: (virtualPath: string) => void
  onCreated: (virtualPath: string) => void
  onDeleted: (virtualPath: string) => void
}

export interface IVirtualFileSystem extends IDisposable {
  /**
   * To resolve the virtual path under the workspace root.
   */
  readonly workspacePathResolver: IWorkspacePathResolver

  /**
   * Copy files or folders, speedup the copy operation.
   * @param sourceVirtualPath
   * @param targetVirtualPath
   * @param overwrite
   * @param recursive
   */
  copy(
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
  >

  /**
   * Create a readable stream to read the entire contents of a file.
   * @param virtualPath
   * @param options
   */
  createReadStream(
    virtualPath: string,
    options?: BufferEncoding,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_IS_DIRECTORY // When the `virtualPath` is a directory.
    | ReadStream // When the operation is executed successfully.
  >

  /**
   * Create a writable stream to write data to a file, replacing its entire contents.
   * @param virtualPath
   * @param options
   */
  createWriteStream(
    virtualPath: string,
    options?: BufferEncoding,
  ): Promise<
    | VfsErrorCode.PARENT_SOURCE_NOT_FOUND // When the parent of `virtualPath` doesn't exist.
    | VfsErrorCode.PARENT_SOURCE_NOT_DIRECTORY // When the parent of `virtualPath` is not a directory.
    | WriteStream // When the operation is executed successfully.
  >

  /**
   * Check if the path exists.
   * @param virtualPath
   */
  isExist(virtualPath: string): Promise<boolean>

  /**
   * Check if the path exists and it is a directory.
   * @param virtualPath
   */
  isDirectory(virtualPath: string): Promise<boolean>

  /**
   * Check if the path exists and it is a file.
   * @param virtualPath
   */
  isFile(virtualPath: string): Promise<boolean>

  /**
   * Create a new directory (Note, that new files are created via `write`-calls).
   * @param virtualPath
   */
  mkdir(virtualPath: string, recursive: boolean): Promise<
    | VfsErrorCode.PARENT_SOURCE_NOT_FOUND // When the parent of `virtualPath` doesn't exist.
    | VfsErrorCode.PARENT_SOURCE_NOT_DIRECTORY // When the parent of `virtualPath` is a directory.
    | VfsErrorCode.SOURCE_EXIST // When `virtualPath` already exists.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  >

  /**
   * Read the entire contents of a file.
   * @param virtualPath
   */
  read(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When the `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_IS_DIRECTORY // When the `virtualPath` is a directory.
    | Uint8Array // File content. // When the operation is executed successfully.
  >

  /**
   * Retrieve all entries of a {@link FileType.Directory directory}.
   * @param virtualPath
   */
  readdir(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When the  `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_NOT_DIRECTORY // When the `virtualPath` is not a directory.
    | string[] // filenames under the dir. // When the operation is executed successfully.
  >

  /**
   * Remove a file or folder.
   * @param virtualPath
   * @param recursive
   */
  remove(
    virtualPath: string,
    recursive: boolean,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | VfsErrorCode.SOURCE_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  >

  /**
   * Rename the file.
   * @param sourceVirtualPath
   * @param targetVirtualPath
   * @param overwrite
   */
  rename(
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
  >

  /**
   * Retrieve metadata about a file.
   * @param virtualPath
   */
  stat(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | IVfsFileStat // File metadata .// When the operation is executed successfully.
  >

  /**
   *
   * @param virtualPath
   * @param options
   */
  watch(
    virtualPath: string,
    options: IVfsFileWatchOptions,
  ):
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | IDisposable // Dispose the watcher. // When the operation is executed successfully.

  /**
   * Write data to a file, replacing its entire contents.
   * @param virtualPath
   * @param content
   * @param create
   * @param overwrite
   */
  write(
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
  >
}
