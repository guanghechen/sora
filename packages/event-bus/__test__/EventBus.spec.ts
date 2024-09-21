import type { IEvent, IEventHandler } from '../src'
import { EventBus } from '../src'

enum EventTypes {
  INIT = 'INIT',
  EXIT = 'EXIT',
}

describe('EventBus', function () {
  describe('listener', function () {
    test('Only event emitted after the listener register could be received', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.on(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 3 } })

      expect(messages.length).toEqual(2)
      expect(messages).toEqual([
        { type: EventTypes.INIT, payload: { id: 2 } },
        { type: EventTypes.INIT, payload: { id: 3 } },
      ])
    })

    test('Only be executed once if the listener registered through the `.once()`', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()

      eventBus.once(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })

      expect(messages.length).toEqual(1)
      expect(messages).toEqual([{ type: EventTypes.INIT, payload: { id: 1 } }])
    })

    test('Only listened events will trigger listener', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.on(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.dispatch({ type: EventTypes.EXIT, payload: { id: 3 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 4 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 5 } })

      expect(messages.length).toEqual(3)
      expect(messages).toEqual([
        { type: EventTypes.INIT, payload: { id: 2 } },
        { type: EventTypes.INIT, payload: { id: 4 } },
        { type: EventTypes.INIT, payload: { id: 5 } },
      ])
    })

    test('Event listener could be unregistered manually', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()
      const [messages2, handle2] = mockEventHandler()

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.on(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.on(EventTypes.INIT, handle2)
      eventBus.dispatch({ type: EventTypes.EXIT, payload: { id: 3 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 4 } })
      eventBus.removeListener(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 5 } })

      expect(messages.length).toEqual(2)
      expect(messages).toEqual([
        { type: EventTypes.INIT, payload: { id: 2 } },
        { type: EventTypes.INIT, payload: { id: 4 } },
      ])

      expect(messages2.length).toEqual(2)
      expect(messages2).toEqual([
        { type: EventTypes.INIT, payload: { id: 4 } },
        { type: EventTypes.INIT, payload: { id: 5 } },
      ])

      expect(
        () => void eventBus.removeListener('invalid-event-type' as any, () => {}),
      ).not.toThrow()
    })

    test('Event listener can only be registered once for each particular event', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.on(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.on(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.EXIT, payload: { id: 3 } })
      eventBus.on(EventTypes.EXIT, handle)
      eventBus.dispatch({ type: EventTypes.EXIT, payload: { id: 4 } })
      eventBus.on(EventTypes.INIT, handle)

      // removeEventListener could be reentrant
      eventBus.removeListener(EventTypes.INIT, handle)
      eventBus.removeListener(EventTypes.INIT, handle)
      eventBus.removeListener(EventTypes.EXIT, handle)
      eventBus.removeListener(EventTypes.EXIT, handle)

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 5 } })
      eventBus.dispatch({ type: EventTypes.EXIT, payload: { id: 6 } })
      eventBus.on(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 7 } })

      expect(messages.length).toEqual(3)
      expect(messages).toEqual([
        { type: EventTypes.INIT, payload: { id: 2 } },
        { type: EventTypes.EXIT, payload: { id: 4 } },
        { type: EventTypes.INIT, payload: { id: 7 } },
      ])
    })

    test('Remove all subscriber after called clear()', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.on(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.on(EventTypes.INIT, handle)

      expect(messages.length).toEqual(1)

      eventBus.cleanup()
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      expect(messages.length).toEqual(1)
    })
  })

  describe('subscriber', function () {
    test('Only event emitted after the subscriber register could be received', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.subscribe(handle, false)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 3 } })

      expect(messages.length).toEqual(2)
      expect(messages).toEqual([
        { type: EventTypes.INIT, payload: { id: 2 } },
        { type: EventTypes.INIT, payload: { id: 3 } },
      ])
    })

    test('Only be executed once if the subscriber registered with once flag `true`', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()

      eventBus.subscribe(handle, true)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })

      expect(messages.length).toEqual(1)
      expect(messages).toEqual([{ type: EventTypes.INIT, payload: { id: 1 } }])
    })

    test('No matter what event will trigger the subscriber', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.subscribe(handle, false)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.dispatch({ type: EventTypes.EXIT, payload: { id: 3 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 4 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 5 } })

      expect(messages.length).toEqual(4)
      expect(messages).toEqual([
        { type: EventTypes.INIT, payload: { id: 2 } },
        { type: EventTypes.EXIT, payload: { id: 3 } },
        { type: EventTypes.INIT, payload: { id: 4 } },
        { type: EventTypes.INIT, payload: { id: 5 } },
      ])
    })

    test('Event subscriber could be unregistered manually', async function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()
      const [messages2, handle2] = mockEventHandler()

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.subscribe(handle, false)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.subscribe(handle2, false)
      eventBus.dispatch({ type: EventTypes.EXIT, payload: { id: 3 } })

      await new Promise<void>(resolve => setTimeout(resolve, 100))

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 4 } })
      eventBus.unsubscribe(handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 5 } })

      expect(messages.length).toEqual(3)
      expect(messages).toEqual([
        { type: EventTypes.INIT, payload: { id: 2 } },
        { type: EventTypes.EXIT, payload: { id: 3 } },
        { type: EventTypes.INIT, payload: { id: 4 } },
      ])

      expect(messages2.length).toEqual(3)
      expect(messages2).toEqual([
        { type: EventTypes.EXIT, payload: { id: 3 } },
        { type: EventTypes.INIT, payload: { id: 4 } },
        { type: EventTypes.INIT, payload: { id: 5 } },
      ])
    })

    test('Event subscriber can only be registered once', function () {
      const eventBus = new EventBus<EventTypes>()
      const [messages, handle] = mockEventHandler()

      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.subscribe(handle, true)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })
      eventBus.subscribe(handle, false)
      eventBus.dispatch({ type: EventTypes.EXIT, payload: { id: 3 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 4 } })
      eventBus.subscribe(handle, true)
      eventBus.unsubscribe(handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 5 } })
      eventBus.subscribe(handle, true)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 6 } })

      expect(messages.length).toEqual(4)
      expect(messages).toEqual([
        { type: EventTypes.INIT, payload: { id: 2 } },
        { type: EventTypes.EXIT, payload: { id: 3 } },
        { type: EventTypes.INIT, payload: { id: 4 } },
        { type: EventTypes.INIT, payload: { id: 6 } },
      ])
    })
  })
})

function mockEventHandler(): [Array<IEvent<EventTypes>>, IEventHandler<EventTypes>] {
  const messages: Array<IEvent<EventTypes>> = []
  const handle = (evt: IEvent<EventTypes>): unknown => messages.push(evt)
  return [messages, handle]
}
