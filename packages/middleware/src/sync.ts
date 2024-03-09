export interface IMiddlewareNext<Output> {
  (embryo: Readonly<Output | null>): Output | null
}

export interface IMiddleware<Input, Output, Api> {
  (
    input: Readonly<Input>,
    embryo: Readonly<Output> | null,
    api: Readonly<Api>,
    next: IMiddlewareNext<Output>,
  ): Output | null
}

export interface IMiddlewares<Input, Output, Api> {
  /**
   * Use a middleware.
   * @param middleware
   */
  use(middleware: IMiddleware<Input, Output, Api>): void
  /**
   * Run with the middlewares.
   * @param input
   * @param api
   */
  reducer(input: Readonly<Input>, api: Readonly<Api>): IMiddlewareNext<Output>
}

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
