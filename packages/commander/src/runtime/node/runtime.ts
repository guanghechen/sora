/**
 * Node runtime adapter
 *
 * @module @guanghechen/commander
 */

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { ICommandRuntime } from '../../command/types'

export function createNodeCommandRuntime(): ICommandRuntime {
  return {
    cwd: () => process.cwd(),
    isAbsolute: filepath => path.isAbsolute(filepath),
    resolve: (...paths) => path.resolve(...paths),
    readFile: filepath => readFile(filepath, 'utf8'),
    stat: filepath => stat(filepath),
  }
}
