import { destroyBytes } from '@guanghechen/byte'
import type { ICipher, ICipherFactory, ICipherOptions } from '@guanghechen/cipher.types'
import { invariant } from '@guanghechen/internal'
import { AesGcmCipher } from './cipher'

interface IProps {
  readonly key: Readonly<Uint8Array>
  readonly iv: Readonly<Uint8Array>
}

export class AesGcmCipherFactory implements ICipherFactory {
  readonly #key: Readonly<Uint8Array>
  readonly #iv: Readonly<Uint8Array>
  #alive: boolean
  #cipher: ICipher | null

  constructor(options: IProps) {
    this.#key = Uint8Array.from(options.key) // Deep clone.
    this.#iv = Uint8Array.from(options.iv) // Deep clone.
    this.#alive = true
    this.#cipher = null
  }

  public get alive(): boolean {
    return this.#alive
  }

  public cipher(options: ICipherOptions = { iv: undefined }): ICipher {
    invariant(this.#alive, '[AesGcmCipherFactory] Factory has been destroyed.')

    const iv: Readonly<Uint8Array> = options.iv ?? this.#iv
    if (iv === this.#iv && this.#cipher !== null) return this.#cipher

    const cipher: ICipher = new AesGcmCipher({ key: this.#key, iv })
    if (iv === this.#iv) this.#cipher = cipher
    return cipher
  }

  public destroy(): void {
    if (this.#alive) {
      destroyBytes(this.#key)
      destroyBytes(this.#iv)
      this.#alive = false
      this.#cipher = null
    }
  }
}
