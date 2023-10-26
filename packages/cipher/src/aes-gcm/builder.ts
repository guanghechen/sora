import { destroyBytes, randomBytes, text2bytes } from '@guanghechen/byte'
import type {
  ICipherFactory,
  ICipherFactoryBuilder,
  IPBKDF2Options,
} from '@guanghechen/cipher.types'
import { calcMac } from '@guanghechen/mac'
import { pbkdf2Sync } from 'node:crypto'
import { AesGcmCipherFactory } from './factory'

interface IProps {
  /**
   * @default 32
   */
  readonly ivSize?: number
  /**
   * @default 12
   */
  readonly keySize?: number
}

export class AesGcmCipherFactoryBuilder implements ICipherFactoryBuilder {
  public readonly keySize: number
  public readonly ivSize: number

  constructor(options: IProps = {}) {
    this.keySize = options.keySize ?? 32
    this.ivSize = options.ivSize ?? 12
  }

  public createRandomIv(): Uint8Array {
    return randomBytes(this.ivSize)
  }

  public createRandomSecret(): Uint8Array {
    return randomBytes(this.keySize + this.ivSize)
  }

  public buildFromSecret(secret: Readonly<Uint8Array>): ICipherFactory {
    const { key, iv } = this._parseSecret(secret)
    return this._build(key, iv)
  }

  public buildFromPassword(
    password: Readonly<Uint8Array>,
    options: IPBKDF2Options,
  ): ICipherFactory {
    const { key, iv } = this._parsePassword(password, options)
    return this._build(key, iv)
  }

  protected _build(key: Uint8Array, iv: Uint8Array): ICipherFactory {
    const factory = new AesGcmCipherFactory({ key, iv })
    destroyBytes(key)
    destroyBytes(iv)
    return factory
  }

  protected _parseSecret(secret: Readonly<Uint8Array>): {
    readonly key: Uint8Array
    readonly iv: Uint8Array
  } {
    const { keySize, ivSize } = this
    const key: Uint8Array = secret.slice(0, keySize)
    const iv: Uint8Array = secret.slice(keySize, keySize + ivSize)
    return { key, iv }
  }

  protected _parsePassword(
    password: Readonly<Uint8Array>,
    options: IPBKDF2Options,
  ): { readonly key: Uint8Array; readonly iv: Uint8Array } {
    const { keySize, ivSize } = this
    const { salt, iterations, digest } = options
    const key: Buffer = pbkdf2Sync(password, salt, iterations, keySize, digest)

    const ivPassword = calcMac([password, text2bytes(salt, 'utf8'), key], digest)
    const iv: Buffer = pbkdf2Sync(ivPassword, salt, iterations + 137, ivSize, digest)
    return {
      key: Uint8Array.from(key),
      iv: Uint8Array.from(iv),
    }
  }
}
