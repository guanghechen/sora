import { randomBytes } from '../src'

describe('random', () => {
  it('randomBytes', () => {
    const bytes1: Uint8Array = randomBytes(32)
    const bytes2: Uint8Array = randomBytes(32)
    expect(bytes1).not.toEqual(bytes2)
    expect(bytes1.length).toEqual(32)
    expect(bytes2.length).toEqual(32)
  })
})
