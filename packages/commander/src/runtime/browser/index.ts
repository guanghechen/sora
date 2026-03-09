/**
 * Browser runtime adapter
 *
 * @module @guanghechen/commander
 */

import type { ICommandRuntime } from '../../command/types'

const WINDOWS_DRIVE_ABSOLUTE_REGEX = /^[a-zA-Z]:[\\/]/

function isAbsolutePath(filepath: string): boolean {
  return (
    filepath.startsWith('/') ||
    filepath.startsWith('\\\\') ||
    WINDOWS_DRIVE_ABSOLUTE_REGEX.test(filepath)
  )
}

function resolvePathFrom(base: string, fragment: string): string {
  const useWindowsStyle = WINDOWS_DRIVE_ABSOLUTE_REGEX.test(base)
  const normalizedBase = base.replace(/\\/g, '/')
  const normalizedFragment = fragment.replace(/\\/g, '/')

  const source = isAbsolutePath(normalizedFragment)
    ? normalizedFragment
    : `${normalizedBase.replace(/\/$/, '')}/${normalizedFragment}`

  const prefix = useWindowsStyle ? source.slice(0, 2) : ''
  const body = useWindowsStyle ? source.slice(2) : source

  const stack: string[] = []
  for (const token of body.split('/')) {
    if (token === '' || token === '.') {
      continue
    }
    if (token === '..') {
      if (stack.length > 0) {
        stack.pop()
      }
      continue
    }
    stack.push(token)
  }

  if (useWindowsStyle) {
    const resolved = `${prefix}/${stack.join('/')}`
    return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved
  }

  return `/${stack.join('/')}`
}

function createUnsupportedFsError(operation: string): Error {
  return new Error(`runtime does not support file-system operation: ${operation}`)
}

function getFallbackCwd(): string {
  const proc = globalThis.process
  if (proc && typeof proc.cwd === 'function') {
    return proc.cwd()
  }

  return '/'
}

export function createBrowserCommandRuntime(): ICommandRuntime {
  return {
    cwd: () => getFallbackCwd(),
    isAbsolute: filepath => isAbsolutePath(filepath),
    resolve: (...paths) => {
      if (paths.length === 0) {
        return getFallbackCwd()
      }

      let resolved = getFallbackCwd()
      for (const path of paths) {
        if (path.length === 0) {
          continue
        }
        resolved = resolvePathFrom(resolved, path)
      }
      return resolved
    },
    readFile: async () => {
      throw createUnsupportedFsError('readFile')
    },
    stat: async () => {
      throw createUnsupportedFsError('stat')
    },
  }
}
