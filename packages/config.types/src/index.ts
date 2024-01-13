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
   * Remove the config data.
   */
  destroy(): Promise<void>

  /**
   * Load data from the given resource or default resource, this will update the holding data.
   */
  load(resource?: ITextResource): Promise<D | never>

  /**
   * Parse the data from the given config content, this won't update the holding data.
   * @param configContent
   */
  parse(configContent: string): Promise<D | never>

  /**
   * Save current holding data into the given resource or default resource.
   */
  save(resource?: ITextResource): Promise<void>

  /**
   * Update the holding data.
   * @param data
   */
  update(data: D): Promise<void>
}
