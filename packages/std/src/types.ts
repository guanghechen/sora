export type IMapper<T, R> = (element: T, index: number) => R

export type IPredicate<T> = (element: T, index: number) => boolean
