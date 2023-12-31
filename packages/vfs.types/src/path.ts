export interface IVfsPathResolver {
  /**
   * Physical root (the workspace dir).
   */
  readonly physicalRoot: string

  /**
   * Virtual root dir.
   */
  readonly virtualRoot: string

  /**
   * Get the parent path of the given physicalPath.
   * @param physicalPath
   */
  dirPhysicalPath(physicalPath: string): string

  /**
   * Get the parent path of the given virtualPath.
   * @param virtualPath
   */
  dirVirtualPath(virtualPath: string): string

  /**
   * Check if the filepath is a physical path.
   * @param filepath
   */
  isPhysicalPath(filepath: string): boolean

  /**
   * Check if the given physical path exists. (only check the path directly, don't consider the file parts)
   * @param physicalPath
   */
  isPhysicalPathExist(physicalPath: string): boolean

  /**
   * Check if the filepath is a virtual path.
   * @param filepath
   */
  isVirtualPath(filepath: string): boolean

  /**
   * Check if the given virtual path exists.
   * @param virtualPath
   */
  isVirtualPathExist(virtualPath: string): boolean

  /**
   * Join the physical path.
   * @param physicalPath
   * @param pathPieces
   */
  joinPhysicalPath(physicalPath: string, ...pathPieces: string[]): string

  /**
   * Join the virtual path.
   * @param virtualPath
   * @param pathPieces
   */
  joinVirtualPath(virtualPath: string, ...pathPieces: string[]): string

  /**
   * Locate the absolute physical filepath by the virtualPath. Since the content could be splitted
   * into multiple files, so we need to known how many parts exist when try to resolve the physical
   * path.
   * @param virtualPath
   */
  locatePhysicalPath(virtualPath: string): { physicalPath: string; partTotal: number }

  /**
   * Normalize the physical path (the given physicalPath should be an valid physicalPath).
   * @param physicalPath
   */
  normalizePhysicalPath(physicalPath: string): string

  /**
   * Normalize the virtual path (the given virtualPath should be an valid virtualPath).
   * @param virtualPath
   */
  normalizeVirtualPath(virtualPath: string): string
}
