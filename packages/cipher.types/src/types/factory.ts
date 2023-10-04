import type { ICipher } from './cipher'

export interface ICipherOptions {
  iv: Buffer | undefined
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
