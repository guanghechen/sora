import { bytes2text ,destroyBytesList, mergeBytes, text2bytes } from '@guanghechen/byte'
import type {
  ICipher,
  IDecipher,
  IDecipherOptions,
  IEncipher,
  IEncryptResult,
} from '@guanghechen/cipher.types'

export abstract class BaseCipher implements ICipher {
  protected _alive: boolean

  constructor() {
    this._alive = true
  }

  public get alive(): boolean {
    return this._alive
  }

  // override
  public abstract encipher(): IEncipher

  // override
  public abstract decipher(options?: IDecipherOptions): IDecipher

  // override
  public encrypt(plainBytes: Readonly<Uint8Array>): IEncryptResult {
    const encipher = this.encipher()
    const cipherBytesList: Uint8Array[] = []

    let cryptBytes: Uint8Array
    let authTag: Uint8Array | undefined
    try {
      // Collect and encrypt data
      cipherBytesList.push(encipher.update(plainBytes))
      cipherBytesList.push(encipher.final())
      cryptBytes = mergeBytes(cipherBytesList)
      authTag = encipher.getAuthTag?.()
    } finally {
      destroyBytesList(cipherBytesList)
      encipher.destroy()
    }
    return { cryptBytes, authTag }
  }

  // override
  public decrypt(cipherBytes: Readonly<Uint8Array>, options?: IDecipherOptions): Uint8Array {
    const decipher = this.decipher(options)
    const plainBytesList: Uint8Array[] = []

    let plainBytes: Uint8Array
    try {
      // Collect and decrypt data
      plainBytesList.push(decipher.update(cipherBytes))
      plainBytesList.push(decipher.final())
      plainBytes = mergeBytes(plainBytesList)
    } finally {
      destroyBytesList(plainBytesList)
      decipher.destroy()
    }
    return plainBytes
  }

  // override
  public encryptJson(plainData: unknown): IEncryptResult {
    const jsonContent: string = JSON.stringify(plainData)
    const plainBytes: Uint8Array = text2bytes(jsonContent, 'utf8')
    return this.encrypt(plainBytes)
  }

  // override
  public decryptJson(cryptBytes: Readonly<Uint8Array>, options?: IDecipherOptions): unknown {
    const plainBytes: Uint8Array = this.decrypt(cryptBytes, options)
    const jsonContent: string = bytes2text(plainBytes, 'utf8')
    return JSON.parse(jsonContent)
  }

  public destroy(): void {
    this._alive = false
  }
}
