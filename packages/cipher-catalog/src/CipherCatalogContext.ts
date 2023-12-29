import { text2bytes } from '@guanghechen/byte'
import type { ICatalogItemForIv, ICipherCatalogContext } from '@guanghechen/cipher-catalog.types'
import type { IHashAlgorithm } from '@guanghechen/mac'
import type { IWorkspacePathResolver } from '@guanghechen/path.types'

export interface ICipherCatalogContextProps {
  readonly contentHashAlgorithm: IHashAlgorithm
  readonly cryptFilepathSalt: string
  readonly cryptFilesDir: string
  readonly cryptPathResolver: IWorkspacePathResolver
  readonly maxTargetFileSize: number
  readonly partCodePrefix: string
  readonly pathHashAlgorithm: IHashAlgorithm
  readonly plainPathResolver: IWorkspacePathResolver
  readonly calcIvFromBytes: (byteList: Iterable<Uint8Array>) => Promise<Uint8Array | undefined>
  readonly isKeepIntegrity: (relativePlainPath: string) => boolean
  readonly isKeepPlain: (relativePlainPath: string) => boolean
}

export class CipherCatalogContext implements ICipherCatalogContext {
  public readonly contentHashAlgorithm: IHashAlgorithm
  public readonly cryptFilepathSalt: string
  public readonly cryptFilesDir: string
  public readonly cryptPathResolver: IWorkspacePathResolver
  public readonly maxTargetFileSize: number
  public readonly partCodePrefix: string
  public readonly pathHashAlgorithm: IHashAlgorithm
  public readonly plainPathResolver: IWorkspacePathResolver
  public readonly isKeepIntegrity: (relativePlainPath: string) => boolean
  public readonly isKeepPlain: (relativePlainPath: string) => boolean
  protected readonly calcIvFromBytes: (
    byteList: Iterable<Uint8Array>,
  ) => Promise<Uint8Array | undefined>

  constructor(props: ICipherCatalogContextProps) {
    const {
      contentHashAlgorithm,
      cryptFilepathSalt,
      maxTargetFileSize,
      partCodePrefix,
      pathHashAlgorithm,
      isKeepIntegrity,
      isKeepPlain,
      calcIvFromBytes: calcIv,
    } = props
    const { cryptPathResolver, plainPathResolver } = props
    const cryptFilesDir = cryptPathResolver.relative(props.cryptFilesDir)

    this.contentHashAlgorithm = contentHashAlgorithm
    this.cryptFilesDir = cryptFilesDir
    this.cryptFilepathSalt = cryptFilepathSalt
    this.cryptPathResolver = cryptPathResolver
    this.maxTargetFileSize = maxTargetFileSize
    this.partCodePrefix = partCodePrefix
    this.pathHashAlgorithm = pathHashAlgorithm
    this.plainPathResolver = plainPathResolver
    this.isKeepIntegrity = isKeepIntegrity
    this.isKeepPlain = isKeepPlain
    this.calcIvFromBytes = calcIv
  }

  public async calcIv(item: ICatalogItemForIv): Promise<Readonly<Uint8Array> | undefined> {
    return this.calcIvFromBytes([text2bytes(item.plainPath, 'hex')])
  }
}
