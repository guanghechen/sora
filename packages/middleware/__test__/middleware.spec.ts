import { describe, expect, it } from 'vitest'
import { AsyncMiddlewares, Middlewares } from '../src'
import type { IAsyncMiddleware, IMiddleware } from '../src'

describe('Middlewares', () => {
  it('should process input through middleware chain', () => {
    const middlewares = new Middlewares<number, number, { multiplier: number }>()

    const addOne: IMiddleware<number, number, { multiplier: number }> = (
      input,
      embryo,
      _api,
      next,
    ) => {
      const result = next(embryo)
      return result !== null ? result + 1 : null
    }

    const multiply: IMiddleware<number, number, { multiplier: number }> = (
      input,
      embryo,
      api,
      next,
    ) => {
      const result = next(embryo)
      return result !== null ? result * api.multiplier : null
    }

    middlewares.use(addOne)
    middlewares.use(multiply)

    const reducer = middlewares.reducer(5, { multiplier: 2 })
    const result = reducer(10)

    expect(result).toBe(21) // (10 * 2) + 1 = 21
  })

  it('should return null when embryo is null', () => {
    const middlewares = new Middlewares<number, number, object>()
    const reducer = middlewares.reducer(5, {})
    const result = reducer(null)

    expect(result).toBeNull()
  })

  it('should work with empty middleware chain', () => {
    const middlewares = new Middlewares<number, number, object>()
    const reducer = middlewares.reducer(5, {})
    const result = reducer(10)

    expect(result).toBe(10)
  })
})

describe('AsyncMiddlewares', () => {
  it('should process input through async middleware chain', async () => {
    const middlewares = new AsyncMiddlewares<number, number, { multiplier: number }>()

    const addOne: IAsyncMiddleware<number, number, { multiplier: number }> = async (
      input,
      embryo,
      _api,
      next,
    ) => {
      const result = await next(embryo)
      return result !== null ? result + 1 : null
    }

    const multiply: IAsyncMiddleware<number, number, { multiplier: number }> = async (
      input,
      embryo,
      api,
      next,
    ) => {
      const result = await next(embryo)
      return result !== null ? result * api.multiplier : null
    }

    middlewares.use(addOne)
    middlewares.use(multiply)

    const reducer = middlewares.reducer(5, { multiplier: 2 })
    const result = await reducer(10)

    expect(result).toBe(21) // (10 * 2) + 1 = 21
  })

  it('should return null when embryo is null', async () => {
    const middlewares = new AsyncMiddlewares<number, number, object>()
    const reducer = middlewares.reducer(5, {})
    const result = await reducer(null)

    expect(result).toBeNull()
  })

  it('should work with empty middleware chain', async () => {
    const middlewares = new AsyncMiddlewares<number, number, object>()
    const reducer = middlewares.reducer(5, {})
    const result = await reducer(10)

    expect(result).toBe(10)
  })
})
