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
