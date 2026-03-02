/**
 * Browser entry
 *
 * @module @guanghechen/commander
 */

import { setDefaultCommandRuntime } from '..'
import { createBrowserCommandRuntime } from './index'

setDefaultCommandRuntime(createBrowserCommandRuntime())

export * from '../../index'
