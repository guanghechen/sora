import {
  BashCompletion,
  Command,
  CommanderError,
  CompletionCommand,
  FishCompletion,
  PwshCompletion,
  isDomain,
  isIp,
  isIpv4,
  isIpv6,
} from '../src'

describe('index exports', () => {
  it('should export Command class', () => {
    expect(Command).toBeDefined()
    expect(typeof Command).toBe('function')
  })

  it('should export CompletionCommand class', () => {
    expect(CompletionCommand).toBeDefined()
    expect(typeof CompletionCommand).toBe('function')
  })

  it('should export BashCompletion class', () => {
    expect(BashCompletion).toBeDefined()
    expect(typeof BashCompletion).toBe('function')
  })

  it('should export FishCompletion class', () => {
    expect(FishCompletion).toBeDefined()
    expect(typeof FishCompletion).toBe('function')
  })

  it('should export PwshCompletion class', () => {
    expect(PwshCompletion).toBeDefined()
    expect(typeof PwshCompletion).toBe('function')
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
})
