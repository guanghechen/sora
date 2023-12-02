import type { IDecipher } from './decipher'
import type { IEncipher } from './encipher'

export interface IDecipherOptions {
  /**
   * The authentication tag.
   */
  readonly authTag: Readonly<Uint8Array> | undefined
}

export interface IEncryptResult {
  /**
   * Encrypted bytes.
   */
  readonly cryptBytes: Readonly<Uint8Array>
  /**
   * The authentication tag.
   */
  readonly authTag?: Readonly<Uint8Array>
}

export interface ICipher {
  /**
   * Check if this instance available.
   */
  readonly alive: boolean

  /**
   * Construct an encipher.
   */
  encipher(): IEncipher

  /**
   * Construct a decipher.
   */
  decipher(options: IDecipherOptions): IDecipher

  /**
   * Encrypt plain data.
   */
  encrypt(plainBytes: Readonly<Uint8Array>): IEncryptResult

  /**
   * Decrypt crypt data.
   */
  decrypt(cipherBytes: Readonly<Uint8Array>, options?: IDecipherOptions): Uint8Array

  /**
   * Encrypt plain json data.
   */
  encryptJson(plainData: unknown): IEncryptResult

  /**
   * Decrypt crypt json data.
   */
  decryptJson(cipherBytes: Readonly<Uint8Array>, options?: IDecipherOptions): unknown

  /**
   * Destroy secret and sensitive data.
   */
  destroy(): void
}
