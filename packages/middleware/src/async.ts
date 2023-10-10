import type {
  IAsyncMiddleware,
  IAsyncMiddlewareNext,
  IAsyncMiddlewares,
} from '@guanghechen/middleware.types'

export class AsyncMiddlewares<Input, Output, Api> implements IAsyncMiddlewares<Input, Output, Api> {
  protected readonly _middlewares: Array<IAsyncMiddleware<Input, Output, Api>>

  constructor() {
    this._middlewares = []
  }

  public use(middleware: IAsyncMiddleware<Input, Output, Api>): void {
    this._middlewares.push(middleware)
  }

  public reducer(input: Readonly<Input>, api: Readonly<Api>): IAsyncMiddlewareNext<Output> {
    const reducer: IAsyncMiddlewareNext<Output> = this._middlewares.reduceRight<
      IAsyncMiddlewareNext<Output>
    >(
      (next, middleware) => embryo => middleware(input, embryo, api, next),
      async embryo => embryo,
    )
    return reducer
  }
}
