/**
 * Runtime adapters
 *
 * @module @guanghechen/commander
 */

import type { ICommandRuntime } from '../types'
import { createBrowserCommandRuntime } from './browser'

let defaultRuntime: ICommandRuntime = createBrowserCommandRuntime()

export function getDefaultCommandRuntime(): ICommandRuntime {
  return defaultRuntime
}

export function setDefaultCommandRuntime(runtime: ICommandRuntime): void {
  defaultRuntime = runtime
}

export * from './browser'
