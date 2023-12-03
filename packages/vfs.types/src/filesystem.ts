import type { IDisposable } from '@guanghechen/disposable.types'
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
   * Retrieve metadata about a file.
   * @param virtualPath
   */
  stat(virtualPath: string): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `virtualPath` doesn't exist.
    | IVfsFileStat // File metadata .// When the operation is executed successfully.
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
   * Create a new directory (Note, that new files are created via `write`-calls).
   * @param virtualPath
   */
  mkdir(virtualPath: string): Promise<
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
   * @param source
   * @param target
   * @param overwrite
   */
  rename(
    source: string,
    target: string,
    overwrite: boolean,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `source` doesn't exist.
    | VfsErrorCode.PARENT_TARGET_NOT_FOUND // When parent of `target` doesn't exist.
    | VfsErrorCode.PARENT_TARGET_NOT_DIRECTORY // When parent of `target` is not a directory.
    | VfsErrorCode.TARGET_EXIST // When `target` exists and when the `overwrite` is not `true`.
    | VfsErrorCode.TARGET_IS_DIRECTORY // When `source` is not a directory but `target` is a directory.
    | VfsErrorCode.TARGET_NOT_DIRECTORY // When `source` is a directory but `target` is not a directory.
    | VfsErrorCode.TARGET_NO_PERMISSION // When permissions aren't sufficient.
    | void // When the operation is executed successfully.
  >

  /**
   * Copy files or folders, speedup the copy operation.
   * @param source
   * @param target
   * @param overwrite
   */
  copy(
    source: string,
    target: string,
    overwrite: boolean,
  ): Promise<
    | VfsErrorCode.SOURCE_NOT_FOUND // When `source` doesn't exist.
    | VfsErrorCode.PARENT_TARGET_NOT_FOUND // When parent of `target` doesn't exist.
    | VfsErrorCode.PARENT_TARGET_NOT_DIRECTORY // When parent of `target` is not a directory.
    | VfsErrorCode.TARGET_EXIST // When `target` exists and when the `overwrite` is not `true`.
    | VfsErrorCode.TARGET_IS_DIRECTORY // When `source` is not a directory but `target` is a directory.
    | VfsErrorCode.TARGET_NOT_DIRECTORY // When `source` is a directory but `target` is not a directory.
    | VfsErrorCode.TARGET_NO_PERMISSION // When permission aren't sufficient.
    | void // When the operation is executed successfully.
  >
}
