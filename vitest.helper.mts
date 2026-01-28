import type { IReporter } from '@guanghechen/reporter.types'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { expect, vi } from 'vitest'
import type { MockInstance } from 'vitest'

// ============================================================================
// Inline utilities from @guanghechen/std to avoid import/no-extraneous-dependencies
// ============================================================================

const identity = <T,>(data: T): T => data
const isArray = (v: unknown): v is unknown[] => Array.isArray(v)
const isNumber = (v: unknown): v is number =>
  Object.prototype.toString.call(v) === '[object Number]'
const isObject = (v: unknown): v is object =>
  Object.prototype.toString.call(v) === '[object Object]'
const isString = (v: unknown): v is string =>
  Object.prototype.toString.call(v) === '[object String]'

// ============================================================================
// Desensitizer utilities (ported from @guanghechen/helper-jest)
// ============================================================================

export type IDesensitizer<T> = (data: T, key?: string) => T

interface IJsonDesensitizerOptions {
  fallback?: IDesensitizer<unknown>
  string?: IDesensitizer<string>
  number?: IDesensitizer<number>
  error?: IDesensitizer<Error>
}

export function createJsonDesensitizer(
  valDesensitizers: IJsonDesensitizerOptions = {},
  keyDesensitizer?: IDesensitizer<string>,
): IDesensitizer<unknown> {
  const fallback = valDesensitizers.fallback == null ? identity : valDesensitizers.fallback
  const desensitizers = {
    key: keyDesensitizer == null ? identity : keyDesensitizer,
    string: valDesensitizers.string == null ? fallback : valDesensitizers.string,
    number: valDesensitizers.number == null ? fallback : valDesensitizers.number,
    error: valDesensitizers.error == null ? fallback : valDesensitizers.error,
    fallback,
  }
  const desensitize = (json: unknown, key?: string): unknown => {
    if (isString(json)) return desensitizers.string(json, key) as string
    if (isNumber(json)) return desensitizers.number(json, key) as number
    if (json instanceof Error) return desensitizers.error(json, key) as Error
    if (isArray(json)) {
      return json.map((value, index) => desensitize(value, '' + index))
    }
    if (isObject(json)) {
      const results: Record<string, unknown> = {}
      for (const _key of Object.keys(json)) {
        const k = desensitizers.key(_key) as string
        results[k] = desensitize((json as Record<string, unknown>)[_key], _key)
      }
      return results
    }
    return desensitizers.fallback(json)
  }
  return desensitize
}

export function createFilepathDesensitizer(
  baseDir: string,
  replaceString: string = '<WORKSPACE>',
): IDesensitizer<string> {
  const source = baseDir
    .replace(/[\\/]*$/, '')
    .replace(/[/\\]+/g, '/')
    .replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1')
    .replace(/\\\//g, '[\\\\|/]')
  const regex = new RegExp(source, 'g')
  return (text: string) => text.replace(regex, replaceString)
}

export function composeStringDesensitizers(
  ...desensitizers: Array<IDesensitizer<string>>
): IDesensitizer<string> {
  return (text: string, key?: string): string => {
    let result = text
    for (const desensitize of desensitizers) {
      result = desensitize(result, key)
    }
    return result
  }
}

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
export const workspaceRootDir = __dirname

/**
 * Desensitize test data.
 */
export const desensitize: IDesensitizer<any> & IDesensitizer<string> = createJsonDesensitizer({
  string: composeStringDesensitizers(
    createFilepathDesensitizer(workspaceRootDir, '<$WORKSPACE$>'),
    text => text.replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, '<$Date$>'),
    text => text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/, '<$ISO-Date$>'),
  ),
}) as IDesensitizer<any>

/**
 * Locate fixture filepath.
 * @param p
 * @returns
 */
export const locateFixtures = (...p: string[]): string => {
  const relativePackagePath: string = path
    .relative(workspaceRootDir, path.resolve())
    .split(path.sep)
    .slice(0, 2)
    .join(path.sep)
  const testRootDior: string = path.resolve(workspaceRootDir, relativePackagePath)
  return path.resolve(testRootDior, '__test__/fixtures', ...p)
}

/**
 * Load fixture filepath.
 * @param p
 * @returns
 */
export const loadFixtures = (...p: string[]): string =>
  fs.readFileSync(locateFixtures(...p), 'utf-8')

/**
 * Remove filepaths
 * @param filepaths
 */
export const unlinkSync = (...filepaths: Array<string | null | undefined | string[]>): void => {
  for (let filepath of filepaths) {
    if (filepath == null) continue
    if (!Array.isArray(filepath)) filepath = [filepath]
    for (const p of filepath) if (fs.existsSync(p)) fs.unlinkSync(p)
  }
}

export const assertPromiseThrow = async (
  fn: () => Promise<unknown>,
  errorPattern: string | RegExp,
): Promise<void> => {
  await expect(() => fn()).rejects.toThrow(errorPattern)
}

export const assertPromiseNotThrow = async (fn: () => Promise<unknown>): Promise<void> => {
  await expect(fn().then(() => {})).resolves.toBeUndefined()
}

export type IConsoleMethodField = 'debug' | 'log' | 'info' | 'warn' | 'error'

export interface IConsoleMock {
  get(methodName: IConsoleMethodField): ReadonlyArray<ReadonlyArray<unknown>>
  getIndiscriminateAll(): ReadonlyArray<ReadonlyArray<unknown>>
  reset(): void
  restore(): void
}

export function createConsoleMock(
  methodNames: ReadonlyArray<IConsoleMethodField> = ['debug', 'log', 'info', 'warn', 'error'],
  desensitizeFn?: (args: unknown[]) => unknown[],
): IConsoleMock {
  const mockFnMap: Record<string, MockInstance> = {}
  const callsMap: Record<string, unknown[][]> = {}
  const allCalls: unknown[][] = []

  for (const field of methodNames) {
    callsMap[field] = []
    mockFnMap[field] = vi.spyOn(console, field).mockImplementation((...args: unknown[]) => {
      const processedArgs = desensitizeFn ? desensitizeFn(args) : args
      callsMap[field].push(processedArgs)
      allCalls.push(processedArgs)
    })
  }

  return {
    get(methodName: IConsoleMethodField): ReadonlyArray<ReadonlyArray<unknown>> {
      return callsMap[methodName] ?? []
    },
    getIndiscriminateAll(): ReadonlyArray<ReadonlyArray<unknown>> {
      return allCalls
    },
    reset(): void {
      for (const field of methodNames) {
        callsMap[field] = []
      }
      allCalls.length = 0
    },
    restore(): void {
      for (const mock of Object.values(mockFnMap)) {
        mock.mockRestore()
      }
    },
  }
}

export interface ICreateReporterMockOptions {
  reporter: IReporter
  spyOnGlobalConsole?: boolean
  consoleMethods?: ReadonlyArray<IConsoleMethodField>
  desensitize?(args: ReadonlyArray<unknown>): unknown[]
}

export interface IReporterMock {
  getIndiscriminateAll(): ReadonlyArray<ReadonlyArray<unknown>>
  reset(): void
  restore(): void
}

export function createReporterMock(options: ICreateReporterMockOptions): IReporterMock {
  const {
    reporter,
    spyOnGlobalConsole = true,
    consoleMethods = ['debug', 'log', 'info', 'warn', 'error'],
    desensitize: desensitizeFn,
  } = options

  const allCalls: unknown[][] = []
  const mocks: MockInstance[] = []
  const consoleMockFnMap: Record<string, MockInstance> = {}

  const logMock = vi
    .spyOn(reporter, 'log')
    .mockImplementation((level: unknown, messageFormat: unknown, messages: unknown[]) => {
      const args = desensitizeFn ? desensitizeFn(messages) : messages
      const text = reporter.format(level as number, messageFormat as string, args as unknown[])
      if (text !== undefined) {
        const processedText = desensitizeFn ? desensitizeFn([text]) : [text]
        allCalls.push(processedText)
      }
    })
  mocks.push(logMock)

  if (spyOnGlobalConsole) {
    for (const field of consoleMethods) {
      consoleMockFnMap[field] = vi
        .spyOn(console, field as IConsoleMethodField)
        .mockImplementation((...args: unknown[]) => {
          const data = desensitizeFn ? desensitizeFn(args) : args
          allCalls.push(data)
        })
    }
  }

  return {
    getIndiscriminateAll(): ReadonlyArray<ReadonlyArray<unknown>> {
      return allCalls.slice()
    },
    reset(): void {
      allCalls.length = 0
    },
    restore(): void {
      logMock.mockRestore()
      if (spyOnGlobalConsole) {
        for (const field of consoleMethods) {
          consoleMockFnMap[field]?.mockRestore()
        }
      }
    },
  }
}
