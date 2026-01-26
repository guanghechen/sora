import path from 'node:path'
import url from 'node:url'
import { findNearestFilepath, locateNearestFilepath } from '../src'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

describe('locateNearestFilepath', function () {
  it('single filename', function () {
    expect(locateNearestFilepath(__dirname, 'package.json')).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(__dirname, 'pnpm-lock.yaml')).toBe(
      path.join(__dirname, '../../../pnpm-lock.yaml'),
    )

    expect(locateNearestFilepath(path.dirname(import.meta.url), 'package.json')).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(path.dirname(import.meta.url), 'pnpm-lock.yaml')).toBe(
      path.join(__dirname, '../../../pnpm-lock.yaml'),
    )
  })

  it('multiple filenames', function () {
    expect(locateNearestFilepath(__dirname, ['package.json'])).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(__dirname, ['package.json', 'pnpm-lock.yaml'])).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(__dirname, ['pnpm-lock.yaml', 'package.json'])).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(__dirname, ['pnpm-lock.yaml', '.editorconfig'])).toBe(
      path.join(__dirname, '../../../pnpm-lock.yaml'),
    )
  })

  it('not found', function () {
    expect(locateNearestFilepath(__dirname, '.xx.yy.zz....xxx' + Math.random())).toBeNull()
  })
})

describe('findNearestFilepath', function () {
  it('basic', function () {
    expect(findNearestFilepath(__dirname, p => path.basename(p) === 'package.json')).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(
      findNearestFilepath(path.dirname(import.meta.url), p => path.basename(p) === 'package.json'),
    ).toBe(path.join(__dirname, '../package.json'))
  })

  it('not found', function () {
    expect(findNearestFilepath(__dirname, () => false)).toBeNull()
  })
})
