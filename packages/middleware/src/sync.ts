import type { IMiddleware, IMiddlewareNext, IMiddlewares } from '@guanghechen/middleware.types'

export class Middlewares<Input, Output, Api> implements IMiddlewares<Input, Output, Api> {
  protected readonly _middlewares: Array<IMiddleware<Input, Output, Api>>

  constructor() {
    this._middlewares = []
  }

  public use(middleware: IMiddleware<Input, Output, Api>): void {
    this._middlewares.push(middleware)
  }

  public reducer(input: Readonly<Input>, api: Readonly<Api>): IMiddlewareNext<Output> {
    const reducer: IMiddlewareNext<Output> = this._middlewares.reduceRight<IMiddlewareNext<Output>>(
      (next, middleware) => embryo => middleware(input, embryo, api, next),
      embryo => embryo,
    )
    return reducer
  }
}
