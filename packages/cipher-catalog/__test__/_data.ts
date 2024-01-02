import { text2bytes } from '@guanghechen/byte'
import { FileChangeTypeEnum } from '@guanghechen/cipher-catalog.types'
import type {
  ICatalogDiffItem,
  ICatalogItem,
  IDraftCatalogItem,
} from '@guanghechen/cipher-catalog.types'
import { DEFAULT_FILEPART_CODE_PREFIX } from '@guanghechen/filepart.types'
import type { IHashAlgorithm } from '@guanghechen/mac'

type ISymbol = 'A' | 'A2' | 'B' | 'C' | 'D'

export const itemDraftTable: Record<ISymbol, IDraftCatalogItem> = {
  A: {
    plainPath: 'a.txt',
    cryptPath: 'a.txt',
    cryptPathParts: [''],
    fingerprint: '4e26698e6bebd87fc210bec49fea4da6210b5769dbff50b3479effa16799120f',
    keepIntegrity: false,
    keepPlain: true,
    nonce: text2bytes('af5e87dbe9a86c24d35df07e5151bb76', 'hex'),
    ctime: 0,
    mtime: 0,
    size: 10,
  },
  A2: {
    plainPath: 'a.txt',
    cryptPath: 'a.txt',
    cryptPathParts: [''],
    fingerprint: '70b47f9cc28ad379043b328d7d058097c69e7bb38d766ecca2655cd3afb6b5fa',
    keepIntegrity: false,
    keepPlain: true,
    nonce: text2bytes('bad9f2912c505861ab5e2680fc58fce9', 'hex'),
    ctime: 0,
    mtime: 0,
    size: 20,
  },
  B: {
    plainPath: 'b.txt',
    cryptPath: 'kirito/d52a60a064cc6ae727b065a078231e41756e9b7fd0cedb301789b0406dc48269',
    cryptPathParts: [''],
    fingerprint: '6fee185efd0ffc7c51f986dcd2eb513e0ce0b63249d9a3bb51efe0c1ed2cb615',
    keepIntegrity: false,
    keepPlain: false,
    nonce: text2bytes('81401d77b434e3c8afe5f0ccb29070e5', 'hex'),
    ctime: 0,
    mtime: 0,
    size: 30,
  },
  C: {
    plainPath: 'c.txt',
    cryptPath: 'kirito/f608f5814560f4375dda3e7dc8005ca6df2176155828349fd73919e8177bf9a7',
    cryptPathParts: ['.ghc-part1', '.ghc-part2', '.ghc-part3', '.ghc-part4'],
    fingerprint: 'b835f16cc543838431fa5bbeceb8906c667c16af9f98779f54541aeae0ccdce2',
    keepIntegrity: false,
    keepPlain: false,
    nonce: text2bytes('f522b4c452b3a58dc267c2a379a77ba7', 'hex'),
    ctime: 0,
    mtime: 0,
    size: 50,
  },
  D: {
    plainPath: 'd.txt',
    cryptPath: 'kirito/3f85a53ebde475b03be7e172d034d9530734639502f2c03e82ee09608af33526',
    cryptPathParts: ['.ghc-part1', '.ghc-part2', '.ghc-part3', '.ghc-part4'],
    fingerprint: '40cb73b4c02d34812f38a5ca3a3f95d377285e83d7bb499573b918e1862bcf13',
    keepIntegrity: false,
    keepPlain: false,
    nonce: text2bytes('fcc19e7111f00303626cfe90ab3fc983', 'hex'),
    ctime: 0,
    mtime: 0,
    size: 60,
  },
}

export const itemTable: Record<ISymbol, ICatalogItem> = {
  A: {
    ...itemDraftTable.A,
    authTag: undefined,
  },
  A2: {
    ...itemDraftTable.A2,
    authTag: undefined,
  },
  B: {
    ...itemDraftTable.B,
    authTag: text2bytes('5519968a852057854b7fea723e301fd6', 'hex'),
  },
  C: {
    ...itemDraftTable.C,
    authTag: text2bytes('dd468a718f2aba0797b8c941159b292e', 'hex'),
  },
  D: {
    ...itemDraftTable.D,
    authTag: text2bytes('6d721d17fe9def40a17a05aa532d3648', 'hex'),
  },
}

export const diffItemsTable: Record<string, ICatalogDiffItem[]> = {
  step1: [
    { changeType: FileChangeTypeEnum.ADDED, newItem: itemTable.A },
    { changeType: FileChangeTypeEnum.ADDED, newItem: itemTable.B },
  ],
  step2: [
    { changeType: FileChangeTypeEnum.REMOVED, oldItem: itemTable.A },
    { changeType: FileChangeTypeEnum.ADDED, newItem: itemTable.C },
  ],
  step3: [
    { changeType: FileChangeTypeEnum.REMOVED, oldItem: itemTable.B },
    { changeType: FileChangeTypeEnum.ADDED, newItem: itemTable.A },
  ],
  step4: [
    { changeType: FileChangeTypeEnum.REMOVED, oldItem: itemTable.C },
    { changeType: FileChangeTypeEnum.ADDED, newItem: itemTable.D },
    { changeType: FileChangeTypeEnum.MODIFIED, oldItem: itemTable.A, newItem: itemTable.A2 },
  ],
  step5: [
    { changeType: FileChangeTypeEnum.REMOVED, oldItem: itemTable.D },
    { changeType: FileChangeTypeEnum.REMOVED, oldItem: itemTable.A2 },
  ],
}

export const contentTable: Record<ISymbol, string> = {
  A: 'Hello, A.',
  A2: 'Hello, A2.'.repeat(3),
  B: 'Hello, B.'.repeat(15),
  C: 'Hello, C.'.repeat(350),
  D: 'Hello, D.'.repeat(350),
}

export const encoding: BufferEncoding = 'utf8'
export const cryptFilesDir = 'kirito'
export const maxTargetFileSize = 1024
export const partCodePrefix = DEFAULT_FILEPART_CODE_PREFIX
export const contentHashAlgorithm: IHashAlgorithm = 'sha256'
export const pathHashAlgorithm: IHashAlgorithm = 'sha256'
