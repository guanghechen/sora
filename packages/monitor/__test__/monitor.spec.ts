import { jest } from '@jest/globals'
import { Monitor } from '../src'

describe('Monitor', () => {
  let monitor: Monitor<[number, string]>

  beforeEach(() => {
    monitor = new Monitor('testMonitor')
  })

  afterEach(() => {
    monitor.destroy()
  })

  it('should subscribe and notify callbacks', () => {
    const callback1 = jest.fn()
    const callback2 = jest.fn()
    const unsubscribe1 = monitor.subscribe(callback1)
    const unsubscribe2 = monitor.subscribe(callback2)

    monitor.notify(42, 'hello')

    expect(callback1).toHaveBeenCalledWith(42, 'hello')
    expect(callback2).toHaveBeenCalledWith(42, 'hello')
    expect(monitor.size).toEqual(2)

    unsubscribe1()
    expect(monitor.size).toEqual(1)

    unsubscribe1()
    expect(monitor.size).toEqual(1)

    monitor.notify(10, 'world')
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(2)
    expect(callback2).toHaveBeenCalledWith(10, 'world')

    monitor.destroy()
    expect(monitor.size).toEqual(0)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(2)

    unsubscribe1()
    unsubscribe2()
    expect(monitor.size).toEqual(0)
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(2)
  })

  it('should unsubscribe from callbacks', () => {
    const callback = jest.fn()
    const unsubscribe = monitor.subscribe(callback)
    expect(monitor.size).toEqual(1)

    monitor.notify(42, 'hello')
    expect(callback).toHaveBeenCalledWith(42, 'hello')

    unsubscribe()
    expect(monitor.size).toEqual(0)

    monitor.notify(10, 'world')
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('should destroy the monitor', () => {
    const callback = jest.fn()
    const unsubscribe = monitor.subscribe(callback)
    expect(monitor.size).toEqual(1)

    monitor.destroy()
    expect(monitor.size).toEqual(0)
    expect(monitor.destroyed).toBe(true)

    monitor.notify(42, 'hello')
    expect(callback).not.toHaveBeenCalled()

    unsubscribe()
    expect(monitor.size).toEqual(0)
    expect(callback).not.toHaveBeenCalled()
  })

  it('should not subscribe to destroyed monitor', () => {
    const callback1 = jest.fn()
    const callback2 = jest.fn()

    const unsubscribe1 = monitor.subscribe(callback1)
    expect(monitor.size).toEqual(1)

    monitor.notify(2, 'waw')
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(0)
    expect(callback1).toHaveBeenCalledWith(2, 'waw')
    expect(callback2).not.toHaveBeenCalledWith(2, 'waw')

    monitor.destroy()
    expect(monitor.size).toEqual(0)
    expect(monitor.destroyed).toBe(true)

    monitor.notify(3, 'waw3')
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(0)
    expect(callback1).not.toHaveBeenCalledWith(3, 'waw3')
    expect(callback2).not.toHaveBeenCalledWith(3, 'waw3')

    const unsubscribe2 = monitor.subscribe(callback2)
    expect(monitor.size).toEqual(0)

    monitor.notify(4, 'waw4')
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(0)
    expect(callback1).not.toHaveBeenCalledWith(4, 'waw4')
    expect(callback2).not.toHaveBeenCalledWith(4, 'waw4')

    unsubscribe1()
    unsubscribe2()
    expect(monitor.size).toEqual(0)

    monitor.notify(5, 'waw5')
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(0)
    expect(callback1).not.toHaveBeenCalledWith(5, 'waw5')
    expect(callback2).not.toHaveBeenCalledWith(5, 'waw5')
  })

  it('should handle callback single errors', () => {
    const erroringCallback1 = jest.fn(() => {
      throw new Error('Callback error1')
    })

    const nonErroringCallback1 = jest.fn()
    const nonErroringCallback2 = jest.fn()

    monitor.subscribe(nonErroringCallback1)
    monitor.subscribe(erroringCallback1)
    monitor.subscribe(nonErroringCallback2)
    expect(monitor.size).toEqual(3)

    expect(() => monitor.notify(42, 'hello')).toThrow(/Callback error1/)
    expect(nonErroringCallback1).toHaveBeenCalled()
    expect(erroringCallback1).toHaveBeenCalled()
    expect(nonErroringCallback2).toHaveBeenCalled()
  })

  it('should handle callback multiple errors', () => {
    const erroringCallback1 = jest.fn(() => {
      throw new Error('Callback error1')
    })

    const erroringCallback2 = jest.fn(() => {
      throw new Error('Callback error2')
    })

    const nonErroringCallback1 = jest.fn()
    const nonErroringCallback2 = jest.fn()
    const nonErroringCallback3 = jest.fn()

    monitor.subscribe(nonErroringCallback1)
    monitor.subscribe(erroringCallback1)
    monitor.subscribe(nonErroringCallback2)
    monitor.subscribe(erroringCallback2)
    monitor.subscribe(nonErroringCallback3)
    expect(monitor.size).toEqual(5)

    expect(() => monitor.notify(42, 'hello')).toThrow(
      `Multiple errors occurred on monitor(${monitor.name})`,
    )

    expect(nonErroringCallback1).toHaveBeenCalled()
    expect(erroringCallback1).toHaveBeenCalled()
    expect(nonErroringCallback2).toHaveBeenCalled()
    expect(erroringCallback2).toHaveBeenCalled()
    expect(nonErroringCallback3).toHaveBeenCalled()
  })

  it('should works fine in competition subscribe', () => {
    const results: unknown[] = []
    let version1 = 0
    let version2 = 0

    const callback1 = jest.fn(function () {
      version1 += 1
      const v = version1
      results.push('A' + v)
      monitor.subscribe(jest.fn(() => results.push('E' + v)))
      monitor.subscribe(jest.fn(() => results.push('F' + v)))
      monitor.subscribe(jest.fn(() => results.push('G' + v)))
    })

    const callback2 = jest.fn(function () {
      version2 += 1
      const v = version2
      results.push('B' + v)
      monitor.subscribe(jest.fn(() => results.push('I' + v)))
      monitor.subscribe(jest.fn(() => results.push('J' + v)))
      monitor.subscribe(jest.fn(() => results.push('K' + v)))
    })

    const callback3 = jest.fn(function () {
      unsubscribe1()
    })

    const unsubscribe1 = monitor.subscribe(callback1)
    const unsubscribe2 = monitor.subscribe(callback2)
    expect(monitor.size).toEqual(2)

    monitor.notify(42, 'hello')

    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback3).toHaveBeenCalledTimes(0)
    expect(callback1).toHaveBeenCalledWith(42, 'hello')
    expect(callback2).toHaveBeenCalledWith(42, 'hello')
    expect(callback3).not.toHaveBeenCalledWith(42, 'hello')
    expect(results).toEqual(['A1', 'B1']) // new added callbacks won't called immediately

    unsubscribe2()
    expect(monitor.size).toEqual(7)

    monitor.notify(10, 'world')
    expect(callback1).toHaveBeenCalledTimes(2)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback3).toHaveBeenCalledTimes(0)
    expect(callback1).toHaveBeenCalledWith(10, 'world')
    expect(callback2).not.toHaveBeenCalledWith(10, 'world')
    expect(callback3).not.toHaveBeenCalledWith(10, 'world')
    expect(results).toEqual(['A1', 'B1', 'A2', 'E1', 'F1', 'G1', 'I1', 'J1', 'K1'])

    const unsubscribe3 = monitor.subscribe(callback3)
    expect(monitor.size).toEqual(11)

    monitor.notify(11, 'world2')
    expect(callback1).toHaveBeenCalledTimes(3)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback3).toHaveBeenCalledTimes(1)
    expect(callback1).toHaveBeenCalledWith(11, 'world2')
    expect(callback2).not.toHaveBeenCalledWith(11, 'world2')
    expect(callback3).toHaveBeenCalledWith(11, 'world2')
    expect(results).toEqual([
      'A1',
      'B1',
      'A2',
      'E1',
      'F1',
      'G1',
      'I1',
      'J1',
      'K1',
      'A3',
      'E1',
      'F1',
      'G1',
      'I1',
      'J1',
      'K1',
      'E2',
      'F2',
      'G2',
    ])

    monitor.destroy()
    expect(monitor.size).toEqual(0)

    monitor.notify(13, 'cool')
    expect(callback1).toHaveBeenCalledTimes(3)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback3).toHaveBeenCalledTimes(1)
    expect(results).toEqual([
      'A1',
      'B1',
      'A2',
      'E1',
      'F1',
      'G1',
      'I1',
      'J1',
      'K1',
      'A3',
      'E1',
      'F1',
      'G1',
      'I1',
      'J1',
      'K1',
      'E2',
      'F2',
      'G2',
    ])

    unsubscribe1()
    unsubscribe3()
    expect(monitor.size).toEqual(0)

    monitor.notify(17, 'cool2')
    expect(callback1).toHaveBeenCalledTimes(3)
    expect(callback2).toHaveBeenCalledTimes(1)
    expect(callback3).toHaveBeenCalledTimes(1)
    expect(results).toEqual([
      'A1',
      'B1',
      'A2',
      'E1',
      'F1',
      'G1',
      'I1',
      'J1',
      'K1',
      'A3',
      'E1',
      'F1',
      'G1',
      'I1',
      'J1',
      'K1',
      'E2',
      'F2',
      'G2',
    ])
  })
})
