import type { ICipher } from './cipher'

export interface ICipherOptions {
  readonly iv: Readonly<Uint8Array> | undefined
}

export interface ICipherFactory {
  readonly alive: boolean

  /**
   * Create a ICipher.
   */
  cipher(options?: ICipherOptions): ICipher

  /**
   * Destroy secret and sensitive data.
   */
  destroy(): void
}
