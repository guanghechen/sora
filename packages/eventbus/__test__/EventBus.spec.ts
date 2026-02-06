import type { IEvent, IEventHandler } from '../src'
import { EventBus } from '../src'

enum EventTypes {
  INIT = 'INIT',
  EXIT = 'EXIT',
}

describe('EventBus', function () {
  describe('name', function () {
    test('name property is set from constructor', function () {
      const eventBus = new EventBus<EventTypes>('myBus')
      expect(eventBus.name).toBe('myBus')
    })
  })

  describe('listener', function () {
    test('Only event emitted after the listener register could be received', function () {
      const eventBus = new EventBus<EventTypes>('test')
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
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      eventBus.once(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })

      expect(messages.length).toEqual(1)
      expect(messages).toEqual([{ type: EventTypes.INIT, payload: { id: 1 } }])
    })

    test('Only listened events will trigger listener', function () {
      const eventBus = new EventBus<EventTypes>('test')
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
      const eventBus = new EventBus<EventTypes>('test')
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
        (): void =>
          void eventBus.removeListener('invalid-event-type' as EventTypes, (): void => {}),
      ).not.toThrow()
    })

    test('Event listener can only be registered once for each particular event', function () {
      const eventBus = new EventBus<EventTypes>('test')
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

    test('Remove all subscriber after called cleanup()', function () {
      const eventBus = new EventBus<EventTypes>('test')
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

    test('off() is alias for removeListener()', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      eventBus.on(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.off(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })

      expect(messages.length).toEqual(1)
      expect(messages).toEqual([{ type: EventTypes.INIT, payload: { id: 1 } }])
    })

    test('on() returns IUnsubscribable', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      const unsub = eventBus.on(EventTypes.INIT, handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      unsub.unsubscribe()
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })

      expect(messages.length).toEqual(1)
      expect(messages).toEqual([{ type: EventTypes.INIT, payload: { id: 1 } }])
    })

    test('once() returns IUnsubscribable', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      const unsub = eventBus.once(EventTypes.INIT, handle)
      unsub.unsubscribe()
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })

      expect(messages.length).toEqual(0)
    })
  })

  describe('subscriber', function () {
    test('Only event emitted after the subscriber register could be received', function () {
      const eventBus = new EventBus<EventTypes>('test')
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
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      eventBus.subscribe(handle, true)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })

      expect(messages.length).toEqual(1)
      expect(messages).toEqual([{ type: EventTypes.INIT, payload: { id: 1 } }])
    })

    test('No matter what event will trigger the subscriber', function () {
      const eventBus = new EventBus<EventTypes>('test')
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
      const eventBus = new EventBus<EventTypes>('test')
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
      const eventBus = new EventBus<EventTypes>('test')
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

    test('subscribe() returns IUnsubscribable', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      const unsub = eventBus.subscribe(handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      unsub.unsubscribe()
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })

      expect(messages.length).toEqual(1)
      expect(messages).toEqual([{ type: EventTypes.INIT, payload: { id: 1 } }])
    })

    test('subscribe() defaults to once=false', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      eventBus.subscribe(handle)
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 2 } })

      expect(messages.length).toEqual(2)
    })
  })

  describe('emit', function () {
    test('emit() is alias for dispatch()', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      eventBus.on(EventTypes.INIT, handle)
      eventBus.emit({ type: EventTypes.INIT, payload: { id: 1 } })
      eventBus.emit({ type: EventTypes.INIT, payload: { id: 2 } })

      expect(messages.length).toEqual(2)
      expect(messages).toEqual([
        { type: EventTypes.INIT, payload: { id: 1 } },
        { type: EventTypes.INIT, payload: { id: 2 } },
      ])
    })
  })

  describe('listenerCount', function () {
    test('listenerCount() returns total count', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [, handle1] = mockEventHandler()
      const [, handle2] = mockEventHandler()
      const [, handle3] = mockEventHandler()

      expect(eventBus.listenerCount()).toEqual(0)

      eventBus.on(EventTypes.INIT, handle1)
      expect(eventBus.listenerCount()).toEqual(1)

      eventBus.on(EventTypes.EXIT, handle2)
      expect(eventBus.listenerCount()).toEqual(2)

      eventBus.subscribe(handle3)
      expect(eventBus.listenerCount()).toEqual(3)

      eventBus.off(EventTypes.INIT, handle1)
      expect(eventBus.listenerCount()).toEqual(2)
    })

    test('listenerCount(type) returns type-specific count', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [, handle1] = mockEventHandler()
      const [, handle2] = mockEventHandler()
      const [, handle3] = mockEventHandler()

      expect(eventBus.listenerCount(EventTypes.INIT)).toEqual(0)
      expect(eventBus.listenerCount(EventTypes.EXIT)).toEqual(0)

      eventBus.on(EventTypes.INIT, handle1)
      eventBus.on(EventTypes.INIT, handle2)
      eventBus.on(EventTypes.EXIT, handle3)

      expect(eventBus.listenerCount(EventTypes.INIT)).toEqual(2)
      expect(eventBus.listenerCount(EventTypes.EXIT)).toEqual(1)
    })
  })

  describe('dispose', function () {
    test('disposed property reflects state', function () {
      const eventBus = new EventBus<EventTypes>('test')
      expect(eventBus.disposed).toBe(false)
      eventBus.dispose()
      expect(eventBus.disposed).toBe(true)
    })

    test('dispose() clears all listeners and subscribers', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      eventBus.on(EventTypes.INIT, handle)
      eventBus.subscribe(handle)
      eventBus.dispose()

      expect(eventBus.listenerCount()).toEqual(0)
    })

    test('dispatch() does nothing after dispose()', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()

      eventBus.on(EventTypes.INIT, handle)
      eventBus.dispose()
      eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })

      expect(messages.length).toEqual(0)
    })

    test('dispose() is idempotent', function () {
      const eventBus = new EventBus<EventTypes>('test')
      eventBus.dispose()
      eventBus.dispose()
      expect(eventBus.disposed).toBe(true)
    })

    test('registerDisposable() registers disposable', function () {
      const eventBus = new EventBus<EventTypes>('test')
      let disposed = false
      const disposable = {
        disposed: false,
        dispose(): void {
          this.disposed = true
          disposed = true
        },
      }

      eventBus.registerDisposable(disposable)
      expect(disposed).toBe(false)

      eventBus.dispose()
      expect(disposed).toBe(true)
    })

    test('registerDisposable() disposes immediately if already disposed', function () {
      const eventBus = new EventBus<EventTypes>('test')
      eventBus.dispose()

      let disposed = false
      const disposable = {
        disposed: false,
        dispose(): void {
          this.disposed = true
          disposed = true
        },
      }

      eventBus.registerDisposable(disposable)
      expect(disposed).toBe(true)
    })

    test('registerDisposable() ignores already disposed disposables', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const disposable = {
        disposed: true,
        dispose: vi.fn(),
      }

      eventBus.registerDisposable(disposable)
      eventBus.dispose()

      expect(disposable.dispose).not.toHaveBeenCalled()
    })
  })

  describe('exception isolation', function () {
    test('handler error does not stop other handlers', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages1, handle1] = mockEventHandler()
      const [messages2, handle2] = mockEventHandler()
      const errorHandler = (): void => {
        throw new Error('test error')
      }

      eventBus.on(EventTypes.INIT, handle1)
      eventBus.on(EventTypes.INIT, errorHandler)
      eventBus.on(EventTypes.INIT, handle2)

      expect(() => eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })).toThrow(
        AggregateError,
      )

      expect(messages1.length).toEqual(1)
      expect(messages2.length).toEqual(1)
    })

    test('subscriber error does not stop listeners', function () {
      const eventBus = new EventBus<EventTypes>('test')
      const [messages, handle] = mockEventHandler()
      const errorSubscriber = (): void => {
        throw new Error('subscriber error')
      }

      eventBus.subscribe(errorSubscriber)
      eventBus.on(EventTypes.INIT, handle)

      expect(() => eventBus.dispatch({ type: EventTypes.INIT, payload: { id: 1 } })).toThrow(
        AggregateError,
      )

      expect(messages.length).toEqual(1)
    })

    test('dispose collects all errors', function () {
      const eventBus = new EventBus<EventTypes>('test')

      eventBus.registerDisposable({
        disposed: false,
        dispose(): void {
          this.disposed = true
          throw new Error('error 1')
        },
      })
      eventBus.registerDisposable({
        disposed: false,
        dispose(): void {
          this.disposed = true
          throw new Error('error 2')
        },
      })

      expect(() => eventBus.dispose()).toThrow(AggregateError)
    })
  })
})

function mockEventHandler(): [Array<IEvent<EventTypes>>, IEventHandler<EventTypes>] {
  const messages: Array<IEvent<EventTypes>> = []
  const handle = (evt: IEvent<EventTypes>): void => {
    messages.push(evt)
  }
  return [messages, handle]
}
