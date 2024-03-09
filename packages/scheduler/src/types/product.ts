export interface IProduct<T> {
  readonly codes: ReadonlyArray<number>
  readonly data: T | null
}
