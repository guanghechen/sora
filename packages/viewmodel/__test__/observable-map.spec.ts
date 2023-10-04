import type { IConsoleMock } from '@guanghechen/helper-jest'
import { createConsoleMock } from '@guanghechen/helper-jest'
import { ObservableMap } from '../src'
import type { IImmutableMap, IObservableMap } from '../src'
import { ImmutableMap, Subscriber } from './_common'

describe('ObservableMap', () => {
  let observableMap: IObservableMap<string, string, IImmutableMap<string, string>>
  let consoleMock: IConsoleMock
  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
  })
  afterEach(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    observableMap = new ObservableMap<string, string, IImmutableMap<string, string>>(
      new ImmutableMap<string, string>(),
    )
  })

  afterEach(() => {
    observableMap.dispose()
  })

  test('observeKey', async () => {
    const observableA = observableMap.observeKey('A')
    const observableB = observableMap.observeKey('B')
    const observableC = observableMap.observeKey('C')
    const subscriberA = new Subscriber<string>('A', '')
    const subscriberB = new Subscriber<string>('B', '')
    const subscriberC = new Subscriber<string>('C', '')
    const unsubscribableA = observableA.subscribe(subscriberA)
    const unsubscribableB = observableB.subscribe(subscriberB)
    const unsubscribableC = observableC.subscribe(subscriberC)

    expect(observableA.disposed).toEqual(false)
    expect(observableB.disposed).toEqual(false)

    expect(observableA.getSnapshot()).toEqual(undefined)
    expect(observableB.getSnapshot()).toEqual(undefined)
    expect(observableC.getSnapshot()).toEqual(undefined)
    expect(subscriberA.value).toEqual('')
    expect(subscriberB.value).toEqual('')
    expect(subscriberC.value).toEqual('')

    observableMap.set('A', 'waw1')
    expect(observableA.getSnapshot()).toEqual('waw1')
    expect(observableB.getSnapshot()).toEqual(undefined)
    expect(observableC.getSnapshot()).toEqual(undefined)
    expect(subscriberA.value).toEqual('waw1')
    expect(subscriberB.value).toEqual('')
    expect(subscriberC.value).toEqual('')

    observableMap.set('B', 'waw2')
    expect(observableA.getSnapshot()).toEqual('waw1')
    expect(observableB.getSnapshot()).toEqual('waw2')
    expect(observableC.getSnapshot()).toEqual(undefined)
    expect(subscriberA.value).toEqual('waw1')
    expect(subscriberB.value).toEqual('waw2')
    expect(subscriberC.value).toEqual('')

    observableMap.set('C', 'waw3')
    observableMap.delete('B')
    expect(observableA.getSnapshot()).toEqual('waw1')
    expect(observableB.getSnapshot()).toEqual(undefined)
    expect(observableC.getSnapshot()).toEqual('waw3')
    expect(subscriberA.value).toEqual('waw1')
    expect(subscriberB.value).toEqual(undefined)
    expect(subscriberC.value).toEqual('waw3')

    observableMap.merge([
      ['A', 'waw1_2'],
      ['B', 'waw2_2'],
    ])
    expect(observableA.getSnapshot()).toEqual('waw1_2')
    expect(observableB.getSnapshot()).toEqual('waw2_2')
    expect(observableC.getSnapshot()).toEqual('waw3')
    expect(subscriberA.value).toEqual('waw1_2')
    expect(subscriberB.value).toEqual('waw2_2')
    expect(subscriberC.value).toEqual('waw3')

    unsubscribableB.unsubscribe()

    observableMap.merge([
      ['B', 'waw2_3'],
      ['C', 'waw3_3'],
    ])
    expect(observableA.getSnapshot()).toEqual('waw1_2')
    expect(observableB.getSnapshot()).toEqual('waw2_3')
    expect(observableC.getSnapshot()).toEqual('waw3_3')
    expect(subscriberA.value).toEqual('waw1_2')
    expect(subscriberB.value).toEqual('waw2_2')
    expect(subscriberC.value).toEqual('waw3_3')

    unsubscribableA.unsubscribe()
    unsubscribableC.unsubscribe()

    observableMap.merge([
      ['A', 'waw1_4'],
      ['B', 'waw2_4'],
      ['C', 'waw3_4'],
    ])
    expect(observableA.getSnapshot()).toEqual('waw1_4')
    expect(observableB.getSnapshot()).toEqual('waw2_4')
    expect(observableC.getSnapshot()).toEqual('waw3_4')
    expect(subscriberA.value).toEqual('waw1_2')
    expect(subscriberB.value).toEqual('waw2_2')
    expect(subscriberC.value).toEqual('waw3_3')

    expect(consoleMock.getIndiscriminateAll()).toMatchInlineSnapshot(`[]`)
  })
})
