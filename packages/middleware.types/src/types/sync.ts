export interface IMiddlewareNext<Output> {
  (embryo: Readonly<Output | null>): Output | null
}

export interface IMiddleware<Input, Output, Api,> {
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
