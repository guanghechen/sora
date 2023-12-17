import { keyOrderSerializer } from '@guanghechen/helper-jest'
import type { NewPlugin as IFormatSerializer } from 'pretty-format'

export const fileTreeSerializer: IFormatSerializer = keyOrderSerializer(
  ['type', 'name', 'ctime', 'mtime', 'size', 'children'],
  () => true,
)
