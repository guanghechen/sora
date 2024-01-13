import { bytes2text, randomBytes, text2bytes } from '@guanghechen/byte'
import type { IConfig, IConfigKeeper } from '@guanghechen/config.types'
import { invariant } from '@guanghechen/internal'
import type { IHashAlgorithm } from '@guanghechen/mac'
import { calcMac } from '@guanghechen/mac'
import type { ITextResource } from '@guanghechen/resource.types'
import satisfies from 'semver/functions/satisfies'

export interface IBaseConfigKeeperProps {
  /**
   * The resource which hold the config data.
   */
  readonly resource: ITextResource
  /**
   * The hash algorithm for generate mac of contents.
   * @default 'sha256'
   */
  readonly hashAlgorithm?: IHashAlgorithm
}

const clazz: string = 'BaseConfigKeeper'

export abstract class BaseConfigKeeper<Instance, Data> implements IConfigKeeper<Instance> {
  public readonly hashAlgorithm: IHashAlgorithm
  public abstract readonly __version__: string
  public abstract readonly __compatible_version__: string

  protected readonly _resource: ITextResource
  protected _instance: Instance | undefined
  protected _nonce: string | undefined

  constructor(props: IBaseConfigKeeperProps) {
    this.hashAlgorithm = props.hashAlgorithm ?? 'sha256'
    this._resource = props.resource
    this._instance = undefined
  }

  // Instance -> Data
  protected abstract serialize(instance: Instance): Promise<Data>

  // Data -> Instance
  protected abstract deserialize(data: Data): Promise<Instance>

  // Data -> string
  protected abstract stringify(data: Data): string

  // IConfig -> string
  protected abstract encode(config: IConfig<Data>): Promise<string>

  // string -> IConfig
  protected abstract decode(stringifiedContent: string): Promise<IConfig<Data>>

  // Generate nonce.
  protected nonce(oldNonce: string | undefined): string | undefined {
    return oldNonce ?? bytes2text(randomBytes(20), 'hex')
  }

  public get data(): Readonly<Instance> | undefined {
    return this._instance
  }

  public compatible(version: string): boolean {
    return satisfies(version, this.__compatible_version__, {
      loose: false,
      includePrerelease: true,
    })
  }

  public async destroy(): Promise<void> {
    await this._resource.destroy()
    this._instance = undefined
  }

  public async load(resource: ITextResource = this._resource): Promise<Instance> {
    const configContent: string | undefined = await resource.load()
    invariant(configContent !== undefined, `[${clazz}.load] Failed to load config.`)

    const config: IConfig<Data> = await this.decode(configContent)
    const { __nonce__ } = config ?? {}

    const instance: Instance = await this._parseFromConfig(config)
    this._instance = instance
    this._nonce = __nonce__
    return instance
  }

  public async parse(configContent: string): Promise<Instance | never> {
    const config: IConfig<Data> = await this.decode(configContent)
    const instance: Instance = await this._parseFromConfig(config)
    return instance
  }

  public async save(resource: ITextResource = this._resource): Promise<void> {
    invariant(this._instance !== undefined, `[${clazz}.save] No valid data holding.`)

    const data: Data = await this.serialize(this._instance)
    const content: string = this.stringify(data)
    const __mac__: string = bytes2text(
      calcMac([text2bytes(content, 'utf8')], this.hashAlgorithm),
      'hex',
    )
    const __nonce__: string | undefined = this.nonce(this._nonce)
    const config: IConfig<Data> = {
      __version__: this.__version__,
      __mac__,
      __nonce__,
      data,
    }
    const stringifiedConfig: string = await this.encode(config)
    await resource.save(stringifiedConfig)
  }

  public async update(instance: Instance): Promise<void> {
    this._instance = instance
  }

  private async _parseFromConfig(config: IConfig<Data>): Promise<Instance | never> {
    const { __version__, __mac__, data } = config ?? {}

    // Check if config is compatible.
    invariant(
      typeof __version__ === 'string' && typeof __mac__ === 'string',
      () => `[${clazz}.load] Bad config, invalid fields. (${JSON.stringify(config)})`,
    )
    invariant(
      this.compatible(__version__),
      `[${clazz}.load] Version not compatible. expect(${this.__compatible_version__}), received(${__version__})`,
    )

    // Check if the config mac is matched.
    const content: string = this.stringify(data)
    const mac = bytes2text(calcMac([text2bytes(content, 'utf8')], this.hashAlgorithm), 'hex')
    invariant(mac === config.__mac__, () => `[${clazz}.load] Bad config, mac is not matched.`)

    const instance: Instance = await this.deserialize(data)
    return instance
  }
}
