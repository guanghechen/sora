/**
 * Node entry
 *
 * @module @guanghechen/commander
 */

import { setDefaultCommandRuntime } from '..'
import { createNodeCommandRuntime } from './runtime'

setDefaultCommandRuntime(createNodeCommandRuntime())

export * from '../../index'
export * from './completion'
export { createNodeCommandRuntime }
