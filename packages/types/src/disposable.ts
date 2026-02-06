/**
 * A disposable object.
 */
export interface IDisposable {
  /**
   * Indicates whether the object has been disposed.
   */
  readonly disposed: boolean

  /**
   * Dispose and perform cleanup.
   */
  dispose(): void
}

/**
 *
 */
export interface IBatchDisposable extends IDisposable {
  /**
   * Register a disposable object, when call `this.dispose()`, all the registered objects will also
   * be disposed.
   * @param disposable
   */
  registerDisposable<T extends IDisposable>(disposable: T): void
}
