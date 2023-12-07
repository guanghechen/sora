import type { IDraftCatalogDiffItem } from '@guanghechen/cipher-catalog.types'
import { FileChangeType } from '@guanghechen/cipher-catalog.types'
import { collectAffectedCryptFilepaths, collectAffectedPlainFilepaths } from '../src'
import { itemTable } from './_data'

const diffItems: IDraftCatalogDiffItem[] = [
  {
    changeType: FileChangeType.ADDED,
    newItem: itemTable.A,
  },
  {
    changeType: FileChangeType.REMOVED,
    oldItem: itemTable.B,
  },
  {
    changeType: FileChangeType.MODIFIED,
    oldItem: itemTable.C,
    newItem: {
      plainFilepath: 'c.txt',
      cryptFilepath: 'd.txt',
      cryptFilepathParts: ['.ghc-part1', '.ghc-part2', '.ghc-part3', '.ghc-part4'],
      fingerprint: '40cb73b4c02d34812f38a5ca3a3f95d377285e83d7bb499573b918e1862bcf13',
      keepPlain: true,
    },
  },
]

test('collectAffectedPlainFilepaths', () => {
  expect(collectAffectedPlainFilepaths(diffItems)).toEqual(['a.txt', 'b.txt', 'c.txt'])
})

test('collectAffectedCryptFilepaths', () => {
  expect(collectAffectedCryptFilepaths(diffItems)).toEqual([
    'a.txt',
    'kirito/d52a60a064cc6ae727b065a078231e41756e9b7fd0cedb301789b0406dc48269',
    'kirito/f608f5814560f4375dda3e7dc8005ca6df2176155828349fd73919e8177bf9a7.ghc-part1',
    'kirito/f608f5814560f4375dda3e7dc8005ca6df2176155828349fd73919e8177bf9a7.ghc-part2',
    'kirito/f608f5814560f4375dda3e7dc8005ca6df2176155828349fd73919e8177bf9a7.ghc-part3',
    'kirito/f608f5814560f4375dda3e7dc8005ca6df2176155828349fd73919e8177bf9a7.ghc-part4',
    'd.txt.ghc-part1',
    'd.txt.ghc-part2',
    'd.txt.ghc-part3',
    'd.txt.ghc-part4',
  ])
})