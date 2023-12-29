import { bytes2text, text2bytes } from '@guanghechen/byte'
import type { ICatalogItem, IDraftCatalogItem } from '@guanghechen/cipher-catalog.types'
import { calcMac } from '@guanghechen/mac'
import { areSameCatalogItem, areSameDraftCatalogItem } from '../src'
import { pathHashAlgorithm } from './_data'

test('areSameDraftCatalogItem', () => {
  const basicItem: IDraftCatalogItem = {
    plainPath: 'waw.txt',
    cryptPath: bytes2text(calcMac([text2bytes('waw.txt', 'utf8')], pathHashAlgorithm), 'hex'),
    cryptPathParts: [''],
    fingerprint: '',
    keepIntegrity: false,
    keepPlain: false,
    ctime: 0,
    mtime: 0,
    size: 60,
  }

  expect(areSameDraftCatalogItem(basicItem, basicItem)).toEqual(true)
  expect(areSameDraftCatalogItem(basicItem, { ...basicItem })).toEqual(true)
  expect(areSameDraftCatalogItem(basicItem, { ...basicItem, plainPath: 'waw2.txt' })).toEqual(false)
  expect(areSameDraftCatalogItem(basicItem, { ...basicItem, cryptPath: 'waw2.txt' })).toEqual(false)
  expect(
    areSameDraftCatalogItem(basicItem, { ...basicItem, cryptPathParts: ['waw2.txt'] }),
  ).toEqual(false)
  expect(
    areSameDraftCatalogItem(basicItem, {
      ...basicItem,
      cryptPathParts: ['waw2.txt', 'waw3.txt'],
    }),
  ).toEqual(false)
  expect(areSameDraftCatalogItem(basicItem, { ...basicItem, keepPlain: true })).toEqual(false)
})

test('areSameCatalogItem', () => {
  const basicItem: ICatalogItem = {
    plainPath: 'waw.txt',
    cryptPath: bytes2text(calcMac([text2bytes('waw.txt', 'utf8')], pathHashAlgorithm), 'hex'),
    cryptPathParts: [''],
    fingerprint: '',
    keepIntegrity: false,
    keepPlain: false,
    iv: text2bytes('dddef89d89c3fe3ca704d5fd', 'hex'),
    authTag: undefined,
    ctime: 0,
    mtime: 0,
    size: 60,
  }

  expect(areSameCatalogItem(basicItem, basicItem)).toEqual(true)
  expect(areSameCatalogItem(basicItem, { ...basicItem })).toEqual(true)
  expect(areSameCatalogItem(basicItem, { ...basicItem, plainPath: 'waw2.txt' })).toEqual(false)
  expect(areSameCatalogItem(basicItem, { ...basicItem, cryptPath: 'waw2.txt' })).toEqual(false)
  expect(areSameCatalogItem(basicItem, { ...basicItem, cryptPathParts: ['waw2.txt'] })).toEqual(
    false,
  )
  expect(
    areSameCatalogItem(basicItem, { ...basicItem, cryptPathParts: ['waw2.txt', 'waw3.txt'] }),
  ).toEqual(false)
  expect(areSameCatalogItem(basicItem, { ...basicItem, keepPlain: true })).toEqual(false)
  expect(
    areSameCatalogItem(basicItem, {
      ...basicItem,
      iv: text2bytes('00ca7b42b7a371351da9a287', 'hex'),
    }),
  ).toEqual(false)
})
