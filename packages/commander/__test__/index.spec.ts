import * as internalExports from '../src/index'
import {
  Command,
  CommanderError,
  isDomain,
  isIp,
  isIpv4,
  isIpv6,
} from '../src/runtime/browser/entry'
import * as browserExports from '../src/runtime/browser/entry'
import * as nodeExports from '../src/runtime/node'

describe('index exports', () => {
  it('should export Command class from browser entry', () => {
    expect(Command).toBeDefined()
    expect(typeof Command).toBe('function')
  })

  it('should not export completion classes from default entry', () => {
    const source = browserExports as Record<string, unknown>
    expect(source['CompletionCommand']).toBeUndefined()
    expect(source['BashCompletion']).toBeUndefined()
    expect(source['FishCompletion']).toBeUndefined()
    expect(source['PwshCompletion']).toBeUndefined()
    expect(source['devmodeOption']).toBeUndefined()
    expect(source['logLevelOption']).toBeUndefined()
    expect(source['COMMAND_ERROR_ISSUE_CODES']).toBeUndefined()
    expect(source['COMMAND_HINT_ISSUE_CODES']).toBeUndefined()
  })

  it('should export completion classes from node entry', () => {
    const source = nodeExports as Record<string, unknown>
    expect(source['CompletionCommand']).toBeDefined()
    expect(source['BashCompletion']).toBeDefined()
    expect(source['FishCompletion']).toBeDefined()
    expect(source['PwshCompletion']).toBeDefined()
    expect(source['devmodeOption']).toBeUndefined()
    expect(source['logLevelOption']).toBeUndefined()
    expect(source['COMMAND_ERROR_ISSUE_CODES']).toBeUndefined()
    expect(source['COMMAND_HINT_ISSUE_CODES']).toBeUndefined()
  })

  it('should export CommanderError class', () => {
    expect(CommanderError).toBeDefined()
    expect(typeof CommanderError).toBe('function')
  })

  it('should export is helpers', () => {
    expect(typeof isIpv4).toBe('function')
    expect(typeof isIpv6).toBe('function')
    expect(typeof isIp).toBe('function')
    expect(typeof isDomain).toBe('function')
  })

  it('should keep internal barrel exports available for entries', () => {
    const source = internalExports as Record<string, unknown>
    expect(typeof source['Command']).toBe('function')
    expect(typeof source['Coerce']).toBe('function')
    expect(typeof source['getDefaultCommandRuntime']).toBe('function')
    expect(source['CompletionCommand']).toBeUndefined()
    expect(source['devmodeOption']).toBeUndefined()
    expect(source['logLevelOption']).toBeUndefined()
    expect(source['COMMAND_ERROR_ISSUE_CODES']).toBeUndefined()
    expect(source['COMMAND_HINT_ISSUE_CODES']).toBeUndefined()
  })
})
