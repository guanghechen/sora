import type { ICipher, ICipherFactory, ICipherOptions } from '@guanghechen/cipher.types'
import { destroyBuffer } from '@guanghechen/internal'
import invariant from '@guanghechen/invariant'
import { AesGcmCipher } from './cipher'

interface IProps {
  key: Buffer
  iv: Buffer
}

export class AesGcmCipherFactory implements ICipherFactory {
  readonly #key: Buffer
  readonly #iv: Buffer
  #alive: boolean
  #cipher: ICipher | null

  constructor(options: IProps) {
    this.#key = Buffer.from(options.key) // Deep clone.
    this.#iv = Buffer.from(options.iv) // Deep clone.
    this.#alive = true
    this.#cipher = null
  }

  public get alive(): boolean {
    return this.#alive
  }

  public cipher(options: ICipherOptions = { iv: undefined }): ICipher {
    invariant(this.#alive, '[AesGcmCipherFactory] Factory has been destroyed.')

    const iv: Buffer = options.iv ?? this.#iv
    if (iv === this.#iv && this.#cipher !== null) return this.#cipher

    const cipher: ICipher = new AesGcmCipher({ key: this.#key, iv })
    if (iv === this.#iv) this.#cipher = cipher
    return cipher
  }

  public destroy(): void {
    if (this.#alive) {
      destroyBuffer(this.#key)
      destroyBuffer(this.#iv)
      this.#alive = false
      this.#cipher = null
    }
  }
}
