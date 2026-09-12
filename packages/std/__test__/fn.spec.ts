import { delay, falsy, identity, noop, truthy } from '../src'

describe('delay', () => {
  it('basic', async () => {
    const currentTime = Date.now()
    const duration = 500
    await delay(duration)
    expect(Date.now() - currentTime + 2).toBeGreaterThanOrEqual(duration)
  })
})

describe('falsy', () => {
  it('no params', () => {
    expect(falsy()).toEqual(false)
  })

  it('with params', () => {
    expect(falsy('some value', 2, 3)).toEqual(false)
  })
})

describe('identity', () => {
  it('basic', () => {
    expect(identity('some value')).toEqual('some value')
  })
})

describe('noop', () => {
  it('no params', () => {
    expect(noop()).toBeUndefined()
  })

  it('with params', () => {
    expect(noop('some value', 2, 3)).toBeUndefined()
  })
})

describe('truthy', () => {
  it('no params', () => {
    expect(truthy()).toEqual(true)
  })

  it('with params', () => {
    expect(truthy('some value', 2, 3)).toEqual(true)
  })
})
