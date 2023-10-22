import { destroyBytes } from '@guanghechen/byte'
import type { ICipher, IDecipher, IDecipherOptions, IEncipher } from '@guanghechen/cipher.types'
import { invariant } from '@guanghechen/internal'
import type { CipherGCM, CipherGCMTypes } from 'node:crypto'
import { createCipheriv, createDecipheriv } from 'node:crypto'
import { BaseCipher } from '../BaseCipher'

interface IProps {
  readonly key: Readonly<Uint8Array>
  readonly iv: Readonly<Uint8Array>
}

export class AesGcmCipher extends BaseCipher implements ICipher {
  readonly #algorithm: CipherGCMTypes = 'aes-256-gcm'
  readonly #key: Readonly<Uint8Array>
  readonly #iv: Readonly<Uint8Array>

  constructor(options: IProps) {
    super()
    this.#key = Uint8Array.from(options.key) // Deep clone.
    this.#iv = Uint8Array.from(options.iv) // Deep clone.
  }

  public override encipher(): IEncipher {
    invariant(
      this.alive,
      '[AesCipher] cannot call `.encipher()` cause the iv and key have been destroyed.',
    )

    const encipher: CipherGCM = createCipheriv(this.#algorithm, this.#key, this.#iv)
    return encipher
  }

  public override decipher(options: IDecipherOptions = { authTag: undefined }): IDecipher {
    invariant(
      this.alive,
      '[AesCipher] cannot call `.decipher()` cause the iv and key have been destroyed.',
    )

    if (options.authTag) {
      const decipher = createDecipheriv(this.#algorithm, this.#key, this.#iv)
      decipher.setAuthTag(options.authTag)
      return decipher
    } else {
      const decipher = createCipheriv(this.#algorithm, this.#key, this.#iv)
      return decipher
    }
  }

  public override destroy(): void {
    if (this.alive) {
      destroyBytes(this.#key)
      super.destroy()
    }
  }
}
