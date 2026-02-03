import type { IConsoleMock } from 'vitest.helper'
import { createConsoleMock } from 'vitest.helper'
import { State } from '../src'

describe('State', () => {
  let state: State<number>
  let consoleMock: IConsoleMock

  beforeEach(() => {
    consoleMock = createConsoleMock(['log', 'warn'])
    state = new State<number>(0)
  })

  afterEach(() => {
    state.dispose()
    consoleMock.restore()
  })

  describe('getSnapshot', () => {
    it('should return the initial value', () => {
      expect(state.getSnapshot()).toBe(0)
    })

    it('should return updated value after setState', () => {
      state.setState(() => 10)
      expect(state.getSnapshot()).toBe(10)
    })
  })

  describe('getServerSnapshot', () => {
    it('should return the same value as getSnapshot', () => {
      expect(state.getServerSnapshot()).toBe(state.getSnapshot())
      state.setState(() => 42)
      expect(state.getServerSnapshot()).toBe(state.getSnapshot())
    })
  })

  describe('setState', () => {
    it('should update state using a patcher function', () => {
      state.setState(prev => prev + 1)
      expect(state.getSnapshot()).toBe(1)

      state.setState(prev => prev * 10)
      expect(state.getSnapshot()).toBe(10)
    })

    it('should receive the previous value in the patcher', () => {
      const patcher = vi.fn((prev: number) => prev + 5)
      state.setState(patcher)
      expect(patcher).toHaveBeenCalledWith(0)
      expect(state.getSnapshot()).toBe(5)
    })

    it('should allow setting to the same value', () => {
      state.setState(() => 0)
      expect(state.getSnapshot()).toBe(0)
    })
  })

  describe('updateState', () => {
    it('should update state with a direct value', () => {
      state.updateState(100)
      expect(state.getSnapshot()).toBe(100)
    })

    it('should update state with a patcher function', () => {
      state.updateState(prev => prev + 50)
      expect(state.getSnapshot()).toBe(50)
    })

    it('should distinguish between function and non-function patches', () => {
      const functionState = new State<(() => number) | null>(null)

      functionState.updateState(() => 42)
      expect(functionState.getSnapshot()).toBe(42)

      functionState.dispose()
    })
  })

  describe('subscribeStateChange', () => {
    it('should call the callback on state change', () => {
      const callback = vi.fn()
      state.subscribeStateChange(callback)

      expect(callback).toHaveBeenCalledTimes(1)

      state.setState(() => 10)
      expect(callback).toHaveBeenCalledTimes(2)

      state.setState(() => 20)
      expect(callback).toHaveBeenCalledTimes(3)
    })

    it('should return an unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = state.subscribeStateChange(callback)

      expect(callback).toHaveBeenCalledTimes(1)

      state.setState(() => 10)
      expect(callback).toHaveBeenCalledTimes(2)

      unsubscribe()

      state.setState(() => 20)
      expect(callback).toHaveBeenCalledTimes(2)
    })

    it('should allow multiple subscribers', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      state.subscribeStateChange(callback1)
      state.subscribeStateChange(callback2)

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)

      state.setState(() => 10)
      expect(callback1).toHaveBeenCalledTimes(2)
      expect(callback2).toHaveBeenCalledTimes(2)
    })

    it('should not call the callback if value does not change (same reference)', () => {
      const callback = vi.fn()
      state.subscribeStateChange(callback)

      expect(callback).toHaveBeenCalledTimes(1)

      state.setState(prev => prev)
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should call the callback immediately on subscribe with current value', () => {
      const callback = vi.fn()
      state.setState(() => 42)

      state.subscribeStateChange(callback)
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('dispose', () => {
    it('should prevent state updates after disposal', () => {
      state.dispose()
      expect(() => state.setState(() => 10)).toThrow(RangeError)
    })

    it('should mark state as disposed', () => {
      expect(state.disposed).toBe(false)
      state.dispose()
      expect(state.disposed).toBe(true)
    })
  })

  describe('complex state types', () => {
    it('should work with object state', () => {
      interface IUserState {
        name: string
        age: number
      }
      const userState = new State<IUserState>({ name: 'Alice', age: 25 })

      userState.updateState({ name: 'Bob', age: 30 })
      expect(userState.getSnapshot()).toEqual({ name: 'Bob', age: 30 })

      userState.setState(prev => ({ ...prev, age: prev.age + 1 }))
      expect(userState.getSnapshot()).toEqual({ name: 'Bob', age: 31 })

      userState.dispose()
    })

    it('should work with array state', () => {
      const arrayState = new State<number[]>([1, 2, 3])

      arrayState.setState(prev => [...prev, 4])
      expect(arrayState.getSnapshot()).toEqual([1, 2, 3, 4])

      arrayState.updateState([5, 6])
      expect(arrayState.getSnapshot()).toEqual([5, 6])

      arrayState.dispose()
    })
  })
})
