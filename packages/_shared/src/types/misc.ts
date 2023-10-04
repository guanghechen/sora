export type Mutable<T> = T extends object
  ? {
      -readonly [K in keyof T]: T[K]
    }
  : T
