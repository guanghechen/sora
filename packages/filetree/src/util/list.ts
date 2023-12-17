/**
 * Replace the list[index] with the given element, return a new list.
 * @param list
 * @param index
 * @param element
 * @returns
 */
export function immutableReplace<T>(
  list: ReadonlyArray<T>,
  index: number,
  element: T,
): ReadonlyArray<T> {
  if (index < 0 || index >= list.length || list[index] === element) return list

  const result: T[] = []
  for (let i = 0; i < index; ++i) result.push(list[i])
  result.push(element)
  for (let i = index + 1; i < list.length; ++i) result.push(list[i])
  return result
}

/**
 * Insert the given element at the given index of the list, return a new list.
 * @param list
 * @param index
 * @param element
 * @returns
 */
export function immutableInsert<T>(
  list: ReadonlyArray<T>,
  index: number,
  element: T,
): ReadonlyArray<T> {
  if (index < 0 || index > list.length) return list

  const result: T[] = []
  for (let i = 0; i < index; ++i) result.push(list[i])
  result.push(element)
  for (let i = index; i < list.length; ++i) result.push(list[i])
  return result
}

/**
 * Remove the element at the given index of the list, return a new list.
 * @param list
 * @param index
 * @returns
 */
export function immutableRemove<T>(list: ReadonlyArray<T>, index: number): ReadonlyArray<T> {
  if (index < 0 || index >= list.length) return list

  const result: T[] = []
  for (let i = 0; i < index; ++i) result.push(list[i])
  for (let i = index + 1; i < list.length; ++i) result.push(list[i])
  return result
}
