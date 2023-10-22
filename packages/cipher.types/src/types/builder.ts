import type { ICipherFactory } from './factory'

export interface IPBKDF2Options {
  salt: string
  iterations: number
  digest: 'sha256'
}

export interface ICipherFactoryBuilder {
  readonly keySize: number
  readonly ivSize: number

  /**
   * Create a random initial vector.
   */
  createRandomIv(): Uint8Array

  /**
   * Create a random secret.
   */
  createRandomSecret(): Uint8Array

  /**
   * Load key/iv of cipher from secret.
   */
  buildFromSecret(secret: Readonly<Uint8Array>): ICipherFactory

  /**
   * Load key/iv of cipher from password.
   */
  buildFromPassword(password: Readonly<Uint8Array>, options: IPBKDF2Options): ICipherFactory
}
