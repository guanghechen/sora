import path from 'node:path'
import url from 'node:url'
import { findNearestFilepath, locateNearestFilepath } from '../src'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

describe('locateNearestFilepath', function () {
  it('single filename', function () {
    expect(locateNearestFilepath(__dirname, 'package.json')).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(__dirname, 'yarn.lock')).toBe(
      path.join(__dirname, '../../../yarn.lock'),
    )

    expect(locateNearestFilepath(path.dirname(import.meta.url), 'package.json')).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(path.dirname(import.meta.url), 'yarn.lock')).toBe(
      path.join(__dirname, '../../../yarn.lock'),
    )
  })

  it('multiple filenames', function () {
    expect(locateNearestFilepath(__dirname, ['package.json'])).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(__dirname, ['package.json', 'yarn.lock'])).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(__dirname, ['yarn.lock', 'package.json'])).toBe(
      path.join(__dirname, '../package.json'),
    )

    expect(locateNearestFilepath(__dirname, ['yarn.lock', '.editorconfig'])).toBe(
      path.join(__dirname, '../../../yarn.lock'),
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
