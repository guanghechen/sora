import { IDecipher } from './decipher'
import { IEncipher } from './encipher'

export interface IDecipherOptions {
  /**
   * The authentication tag.
   */
  authTag: Buffer | undefined
}

export interface IEncryptResult {
  /**
   * Encrypted bytes.
   */
  cryptBytes: Buffer
  /**
   * The authentication tag.
   */
  authTag?: Buffer
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
  encrypt(plainBytes: Readonly<Buffer>): IEncryptResult

  /**
   * Decrypt crypt data.
   */
  decrypt(cipherBytes: Readonly<Buffer>, options?: IDecipherOptions): Buffer

  /**
   * Encrypt plain json data.
   */
  encryptJson(plainData: unknown): IEncryptResult

  /**
   * Decrypt crypt json data.
   */
  decryptJson(cipherBytes: Readonly<Buffer>, options?: IDecipherOptions): unknown

  /**
   * Destroy secret and sensitive data.
   */
  destroy(): void
}
