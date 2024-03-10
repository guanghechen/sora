import { jest } from '@jest/globals'
import type { ISubscriber } from '../src'
import { Subscriber } from '../src'

describe('subscriber', () => {
  it('default', () => {
    const onNext = jest.fn()
    const subscriber: ISubscriber<string> = new Subscriber<string>({ onNext })

    expect(subscriber.disposed).toEqual(false)
    expect(onNext).toHaveBeenCalledTimes(0)

    subscriber.next('A', undefined)
    expect(subscriber.disposed).toEqual(false)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenLastCalledWith('A', undefined)

    subscriber.next('B', 'A')
    expect(subscriber.disposed).toEqual(false)
    expect(onNext).toHaveBeenCalledTimes(2)
    expect(onNext).toHaveBeenLastCalledWith('B', 'A')

    subscriber.dispose()
    expect(subscriber.disposed).toEqual(true)
    expect(onNext).toHaveBeenCalledTimes(2)

    subscriber.dispose()
    expect(subscriber.disposed).toEqual(true)
    expect(onNext).toHaveBeenCalledTimes(2)

    subscriber.next('C', 'B')
    expect(subscriber.disposed).toEqual(true)
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('customized onDispose', () => {
    const onNext = jest.fn()
    const onDispose = jest.fn()
    const subscriber: ISubscriber<string> = new Subscriber<string>({ onNext, onDispose })

    expect(subscriber.disposed).toEqual(false)
    expect(onNext).toHaveBeenCalledTimes(0)
    expect(onDispose).toHaveBeenCalledTimes(0)

    subscriber.next('A', undefined)
    expect(subscriber.disposed).toEqual(false)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenLastCalledWith('A', undefined)
    expect(onDispose).toHaveBeenCalledTimes(0)

    subscriber.next('B', 'A')
    expect(subscriber.disposed).toEqual(false)
    expect(onNext).toHaveBeenCalledTimes(2)
    expect(onNext).toHaveBeenLastCalledWith('B', 'A')
    expect(onDispose).toHaveBeenCalledTimes(0)

    subscriber.dispose()
    expect(subscriber.disposed).toEqual(true)
    expect(onNext).toHaveBeenCalledTimes(2)
    expect(onDispose).toHaveBeenCalledTimes(1)

    subscriber.dispose()
    expect(subscriber.disposed).toEqual(true)
    expect(onNext).toHaveBeenCalledTimes(2)
    expect(onDispose).toHaveBeenCalledTimes(1)

    subscriber.next('C', 'B')
    expect(subscriber.disposed).toEqual(true)
    expect(onNext).toHaveBeenCalledTimes(2)
    expect(onDispose).toHaveBeenCalledTimes(1)
  })
})
