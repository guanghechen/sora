import type { IConsoleMock } from 'vitest.helper'
import { createConsoleMock } from 'vitest.helper'
import { Observable, State, ViewModel } from '../src'
import type { IViewModelTicker } from '../src'
import { TestSubscriber } from './_common'

class TestViewModel extends ViewModel {
  public readonly count$: Observable<number>
  public readonly name$: State<string>
  public readonly items$: Observable<string[]>
  public notAnObservable: string

  constructor() {
    super()
    this.count$ = new Observable<number>(0)
    this.name$ = new State<string>('initial')
    this.items$ = new Observable<string[]>([])
    this.notAnObservable = 'just a string'
  }
}

describe('ViewModel', () => {
  let viewModel: TestViewModel
  let consoleMock: IConsoleMock

  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
    viewModel = new TestViewModel()
  })

  afterEach(() => {
    viewModel.dispose()
    consoleMock.restore()
  })

  describe('ticker', () => {
    it('should create a ticker for a single observable', () => {
      const ticker = viewModel.ticker(['count$'])

      expect(ticker).toBeDefined()
      expect(ticker.keys).toEqual(['count$'])
      expect(ticker.ticker).toBeDefined()
    })

    it('should create a ticker for multiple observables', () => {
      const ticker = viewModel.ticker(['count$', 'name$'])

      expect(ticker.keys).toEqual(expect.arrayContaining(['count$', 'name$']))
      expect(ticker.keys.length).toBe(2)
    })

    it('should return the same ticker for the same keys', () => {
      const ticker1 = viewModel.ticker(['count$', 'name$'])
      const ticker2 = viewModel.ticker(['count$', 'name$'])

      expect(ticker1).toBe(ticker2)
    })

    it('should return the same ticker regardless of key order', () => {
      const ticker1 = viewModel.ticker(['count$', 'name$'])
      const ticker2 = viewModel.ticker(['name$', 'count$'])

      expect(ticker1).toBe(ticker2)
    })

    it('should deduplicate keys', () => {
      const ticker = viewModel.ticker(['count$', 'count$', 'name$'])

      expect(ticker.keys.length).toBe(2)
      expect(ticker.keys).toEqual(expect.arrayContaining(['count$', 'name$']))
    })

    it('should tick when any observed observable changes', () => {
      const ticker = viewModel.ticker(['count$', 'name$'])
      const callback = vi.fn()
      const subscriber = new TestSubscriber<number>('tick', 0)
      subscriber.next = callback

      ticker.ticker.subscribe(subscriber)
      callback.mockClear()

      viewModel.count$.next(1)
      expect(callback).toHaveBeenCalledTimes(1)

      viewModel.name$.updateState('changed')
      expect(callback).toHaveBeenCalledTimes(2)
    })

    it('should not tick for non-observed observables', () => {
      const ticker = viewModel.ticker(['count$'])
      const callback = vi.fn()
      const subscriber = new TestSubscriber<number>('tick', 0)
      subscriber.next = callback

      ticker.ticker.subscribe(subscriber)
      callback.mockClear()

      viewModel.name$.updateState('changed')
      expect(callback).not.toHaveBeenCalled()

      viewModel.count$.next(1)
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should warn for non-observable keys', () => {
      viewModel.ticker(['notAnObservable' as any])

      const logs = consoleMock.getIndiscriminateAll()
      expect(logs.length).toBeGreaterThan(0)
      expect(logs.some(log => Array.isArray(log) && log[0]?.includes('[ViewModel.ticker]'))).toBe(
        true,
      )
    })

    it('should create separate tickers for different key combinations', () => {
      const ticker1 = viewModel.ticker(['count$'])
      const ticker2 = viewModel.ticker(['name$'])
      const ticker3 = viewModel.ticker(['count$', 'name$'])

      expect(ticker1).not.toBe(ticker2)
      expect(ticker1).not.toBe(ticker3)
      expect(ticker2).not.toBe(ticker3)
    })
  })

  describe('dispose', () => {
    it('should mark the viewmodel as disposed', () => {
      expect(viewModel.disposed).toBe(false)
      viewModel.dispose()
      expect(viewModel.disposed).toBe(true)
    })

    it('should dispose all observables ending with $', () => {
      viewModel.dispose()

      expect(viewModel.count$.disposed).toBe(true)
      expect(viewModel.name$.disposed).toBe(true)
      expect(viewModel.items$.disposed).toBe(true)
    })

    it('should dispose all created tickers', () => {
      const ticker1 = viewModel.ticker(['count$'])
      const ticker2 = viewModel.ticker(['name$'])

      expect(ticker1.ticker.disposed).toBe(false)
      expect(ticker2.ticker.disposed).toBe(false)

      viewModel.dispose()

      expect(ticker1.ticker.disposed).toBe(true)
      expect(ticker2.ticker.disposed).toBe(true)
    })

    it('should be idempotent', () => {
      viewModel.dispose()
      expect(() => viewModel.dispose()).not.toThrow()
      expect(viewModel.disposed).toBe(true)
    })

    it('should clear the ticker map', () => {
      const ticker1 = viewModel.ticker(['count$'])
      viewModel.dispose()

      expect(ticker1.ticker.disposed).toBe(true)
    })
  })

  describe('registerDisposable', () => {
    it('should register a disposable that gets disposed with the viewmodel', () => {
      const mockDispose = vi.fn()
      const disposable = { dispose: mockDispose, disposed: false }

      viewModel.registerDisposable(disposable)

      expect(mockDispose).not.toHaveBeenCalled()

      viewModel.dispose()
      expect(mockDispose).toHaveBeenCalled()
    })
  })

  describe('integration', () => {
    it('should work with complex state updates and subscriptions', () => {
      const ticker = viewModel.ticker(['count$', 'name$', 'items$'])
      const tickCallback = vi.fn()
      const tickSubscriber = new TestSubscriber<number>('tick', 0)
      tickSubscriber.next = tickCallback

      ticker.ticker.subscribe(tickSubscriber)
      tickCallback.mockClear()

      viewModel.count$.next(10)
      expect(tickCallback).toHaveBeenCalledTimes(1)

      viewModel.name$.updateState('updated')
      expect(tickCallback).toHaveBeenCalledTimes(2)

      viewModel.items$.next(['a', 'b'])
      expect(tickCallback).toHaveBeenCalledTimes(3)

      expect(viewModel.count$.getSnapshot()).toBe(10)
      expect(viewModel.name$.getSnapshot()).toBe('updated')
      expect(viewModel.items$.getSnapshot()).toEqual(['a', 'b'])
    })

    it('should handle symbol keys correctly (not dispose them)', () => {
      const symbolKey = Symbol('test')

      class ViewModelWithSymbol extends ViewModel {
        public readonly value$: Observable<number>;
        [key: symbol]: any

        constructor() {
          super()
          this.value$ = new Observable(0)
          this[symbolKey] = { dispose: vi.fn(), disposed: false }
        }
      }

      const vm = new ViewModelWithSymbol()
      const symbolDisposable = vm[symbolKey]

      vm.dispose()

      expect(vm.value$.disposed).toBe(true)
      expect(symbolDisposable.dispose).not.toHaveBeenCalled()
    })
  })
})

describe('ViewModel ticker caching', () => {
  it('should properly cache tickers by sorted key string', () => {
    class MultiObservableViewModel extends ViewModel {
      public readonly a$: Observable<number>
      public readonly b$: Observable<number>
      public readonly c$: Observable<number>

      constructor() {
        super()
        this.a$ = new Observable(1)
        this.b$ = new Observable(2)
        this.c$ = new Observable(3)
      }
    }

    const vm = new MultiObservableViewModel()

    const ticker1 = vm.ticker(['a$', 'b$', 'c$'])
    const ticker2 = vm.ticker(['c$', 'b$', 'a$'])
    const ticker3 = vm.ticker(['b$', 'a$', 'c$'])

    expect(ticker1).toBe(ticker2)
    expect(ticker2).toBe(ticker3)

    const tickerAB = vm.ticker(['a$', 'b$'])
    const tickerAC = vm.ticker(['a$', 'c$'])
    const tickerBC = vm.ticker(['b$', 'c$'])

    expect(tickerAB).not.toBe(tickerAC)
    expect(tickerAC).not.toBe(tickerBC)
    expect(tickerAB).not.toBe(tickerBC)

    vm.dispose()
  })
})
