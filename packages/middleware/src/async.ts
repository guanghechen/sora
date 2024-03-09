export interface IAsyncMiddlewareNext<Output> {
  (embryo: Readonly<Output | null>): Promise<Output | null>
}

export interface IAsyncMiddleware<Input, Output, Api> {
  (
    input: Readonly<Input>,
    embryo: Readonly<Output> | null,
    api: Readonly<Api>,
    next: IAsyncMiddlewareNext<Output>,
  ): Promise<Output | null>
}

export interface IAsyncMiddlewares<Input, Output, Api> {
  /**
   * Use a middleware.
   * @param middleware
   */
  use(middleware: IAsyncMiddleware<Input, Output, Api>): void
  /**
   * Run with the middlewares.
   * @param input
   * @param api
   */
  reducer(input: Readonly<Input>, api: Readonly<Api>): IAsyncMiddlewareNext<Output>
}

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
