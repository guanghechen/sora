import { text2bytes } from '@guanghechen/byte'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

export const simple = (() => {
  const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'simple')
  const PHYSICAL_DIRNAME = 'physical'
  const VIRTUAL_DIRNAME = 'virtual'
  const FIXTURE_PHYSICAL_DIR = path.join(FIXTURE_DIR, PHYSICAL_DIRNAME)
  const FIXTURE_VIRTUAL_DIR = path.join(FIXTURE_DIR, VIRTUAL_DIRNAME)

  const FILEPATH_1 = 'a/b/c.md'
  const FILEPATH_2 = 'a/d.md'
  const CONTENT_1 = text2bytes('Content c.\n', 'utf8')
  const CONTENT_2 = text2bytes('Content d.\n', 'utf8')

  return {
    FIXTURE_DIR,
    PHYSICAL_DIRNAME,
    VIRTUAL_DIRNAME,
    FIXTURE_PHYSICAL_DIR,
    FIXTURE_VIRTUAL_DIR,
    FILEPATH_1,
    FILEPATH_2,
    CONTENT_1,
    CONTENT_2,
  }
})()
