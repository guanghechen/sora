import { invariant } from '@guanghechen/invariant'
import type { IFilePartItem } from './types'

/**
 * Generate file part items by part size.
 *
 * @param fileSize
 * @param _partSize
 * @returns
 */
export function* calcFilePartItemsBySize(
  fileSize: number,
  partSize: number,
): IterableIterator<IFilePartItem> {
  if (fileSize <= 0) {
    yield { sid: 1, start: 0, end: 0 }
    return
  }

  if (fileSize <= partSize) {
    yield { sid: 1, start: 0, end: fileSize }
    return
  }

  invariant(partSize >= 1 && Number.isInteger(partSize), 'Part size should be a positive integer!')

  const partTotal = Math.ceil(fileSize / partSize)
  invariant(partTotal > 0, 'Part size is too small!')

  for (let i = 0; i < partTotal; ++i) {
    const part: IFilePartItem = {
      sid: i + 1,
      start: i * partSize,
      end: i + 1 === partTotal ? fileSize : (i + 1) * partSize,
    }
    yield part
  }
}

/**
 * Generate file part items by total of parts.
 *
 * @param filepath
 * @param partTotal
 * @returns
 */
export function* calcFilePartItemsByCount(
  fileSize: number,
  partTotal: number,
): IterableIterator<IFilePartItem> {
  invariant(
    partTotal >= 1 && Number.isInteger(partTotal),
    'Total of part should be a positive integer!',
  )

  if (fileSize <= 0) {
    yield { sid: 1, start: 0, end: 0 }
    return
  }

  if (partTotal === 1) {
    yield { sid: 1, start: 0, end: fileSize }
    return
  }

  const partSize = Math.ceil(fileSize / partTotal)
  invariant(partSize > 0, 'Part size is too small!')

  for (let i = 0; i < partTotal; ++i) {
    const part: IFilePartItem = {
      sid: i + 1,
      start: i * partSize,
      end: i + 1 === partTotal ? fileSize : (i + 1) * partSize,
    }
    yield part
  }
}

/**
 * Calculate names of parts of sourcefile respectively.
 *
 * @param parts
 * @param partCodePrefix
 * @returns
 */
export function* calcFilePartNames(
  parts: ReadonlyArray<Pick<IFilePartItem, 'sid'>>,
  partCodePrefix: string,
): IterableIterator<string> {
  if (parts.length === 0) return
  if (parts.length === 1) {
    yield ''
    return
  }

  // Part name (file name of part)
  // get the max number of digits to generate for part number
  // ex. if original file is split into 4 files, then it will be 1
  // ex. if original file is split into 14 files, then it will be 2
  // etc.
  const maxPaddingCount: number = String(parts.length).length

  for (const part of parts) {
    // construct part number for current file part, e.g. (assume the partCodePrefix is ".ghc-part")
    //
    //    .ghc-part01
    //    ...
    //    .ghc-part14
    const partCode: string = String(part.sid).padStart(maxPaddingCount, '0')
    const partName: string = partCodePrefix + partCode
    yield partName
  }
}

export function* calcFilePartNamesByCount(
  partTotal: number,
  partCodePrefix: string,
): IterableIterator<string> {
  if (partTotal <= 0) return
  if (partTotal === 1) {
    yield ''
    return
  }

  const maxPaddingCount = String(partTotal).length
  for (let sid = 1; sid <= partTotal; ++sid) {
    const partCode: string = String(sid).padStart(maxPaddingCount, '0')
    const partName: string = partCodePrefix + partCode
    yield partName
  }
}
