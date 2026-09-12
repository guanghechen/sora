import { invariant } from '../src'

describe('development', () => {
  it('truthy', () => {
    expect(() => void invariant(false, 'waw')).toThrow('Invariant failed: waw')
    expect(() => void invariant(false, () => 'waw')).toThrow('Invariant failed: waw')
    expect(() => void invariant(false)).toThrow('Invariant failed: ')
  })

  it('falsy', () => {
    expect(() => void invariant(true, 'waw')).not.toThrow()
    expect(() => void invariant(true)).not.toThrow()
  })
})
