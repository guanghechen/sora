export interface IResource<T> {
  /**
   * Check if the resource exist.
   */
  exists(): Promise<boolean>

  /**
   * Load the resource.
   */
  load(): Promise<T | undefined>

  /**
   * Save the resource.
   */
  save(data: T): Promise<void>

  /**
   * Destroy the resource.
   */
  destroy(): Promise<void>
}

export type ITextResource = IResource<string>
