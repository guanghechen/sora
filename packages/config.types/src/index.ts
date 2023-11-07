import type { ITextResource } from '@guanghechen/resource.types'

export interface IConfig<Data> {
  /**
   * Config version.
   */
  __version__: string
  /**
   * Mac of data.
   */
  __mac__: string
  /**
   * A random string.
   */
  __nonce__: string | undefined
  /**
   * Payload data.
   */
  data: Data
}

export interface IConfigKeeper<D> {
  readonly __version__: string
  readonly __compatible_version__: string

  /**
   * Current holding data.
   */
  readonly data: Readonly<D> | undefined

  /**
   * Check if the given version is compatible.
   * @param version
   */
  compatible(version: string): boolean

  /**
   * Update the holding data.
   * @param data
   */
  update(data: D): Promise<void>

  /**
   * Load data from the given resource or default resource.
   */
  load(resource?: ITextResource): Promise<void>

  /**
   * Save current holding data into the given resource or default resource.
   */
  save(resource?: ITextResource): Promise<void>

  /**
   * Remove the config data.
   */
  destroy(): Promise<void>
}
