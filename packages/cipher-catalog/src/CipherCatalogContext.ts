import { randomBytes } from '@guanghechen/byte'
import type { ICatalogItemForNonce, ICipherCatalogContext } from '@guanghechen/cipher-catalog.types'
import type { IHashAlgorithm } from '@guanghechen/mac'
import type { IWorkspacePathResolver } from '@guanghechen/path.types'

export interface ICipherCatalogContextProps {
  readonly CONTENT_HASH_ALGORITHM: IHashAlgorithm
  readonly MAX_CRYPT_FILE_SIZE: number
  readonly NONCE_SIZE: number
  readonly PART_CODE_PREFIX: string
  readonly PATH_HASH_ALGORITHM: IHashAlgorithm
  readonly cryptFilesDir: string
  readonly cryptPathSalt: string
  readonly cryptPathResolver: IWorkspacePathResolver
  readonly plainPathResolver: IWorkspacePathResolver
  readonly isKeepIntegrity: (relativePlainPath: string) => boolean
  readonly isKeepPlain: (relativePlainPath: string) => boolean
  readonly isPlainPathExist: (relativePlainPath: string) => boolean
}

export class CipherCatalogContext implements ICipherCatalogContext {
  public readonly CONTENT_HASH_ALGORITHM: IHashAlgorithm
  public readonly MAX_CRYPT_FILE_SIZE: number
  public readonly NONCE_SIZE: number
  public readonly PART_CODE_PREFIX: string
  public readonly PATH_HASH_ALGORITHM: IHashAlgorithm
  public readonly cryptFilesDir: string
  public readonly cryptPathSalt: string
  public readonly cryptPathResolver: IWorkspacePathResolver
  public readonly plainPathResolver: IWorkspacePathResolver
  public readonly isKeepIntegrity: (relativePlainPath: string) => boolean
  public readonly isKeepPlain: (relativePlainPath: string) => boolean
  public readonly isPlainPathExist: (relativePlainPath: string) => boolean

  constructor(props: ICipherCatalogContextProps) {
    const {
      CONTENT_HASH_ALGORITHM,
      MAX_CRYPT_FILE_SIZE,
      NONCE_SIZE,
      PART_CODE_PREFIX,
      PATH_HASH_ALGORITHM,
      cryptPathSalt,
      isKeepIntegrity,
      isKeepPlain,
      isPlainPathExist,
    } = props
    const { cryptPathResolver, plainPathResolver } = props
    const cryptFilesDir = cryptPathResolver.relative(props.cryptFilesDir)

    this.CONTENT_HASH_ALGORITHM = CONTENT_HASH_ALGORITHM
    this.MAX_CRYPT_FILE_SIZE = MAX_CRYPT_FILE_SIZE
    this.NONCE_SIZE = NONCE_SIZE
    this.PART_CODE_PREFIX = PART_CODE_PREFIX
    this.PATH_HASH_ALGORITHM = PATH_HASH_ALGORITHM
    this.cryptFilesDir = cryptFilesDir
    this.cryptPathSalt = cryptPathSalt
    this.cryptPathResolver = cryptPathResolver
    this.plainPathResolver = plainPathResolver
    this.isKeepIntegrity = isKeepIntegrity
    this.isKeepPlain = isKeepPlain
    this.isPlainPathExist = isPlainPathExist
  }

  public async genNonce(item: ICatalogItemForNonce): Promise<Readonly<Uint8Array> | undefined> {
    return item.nonce ?? randomBytes(this.NONCE_SIZE)
  }
}
