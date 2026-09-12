/**
 * Filters an array in place, modifying the original array directly.
 *
 * @typeParam T - The type of the elements in the array.
 * @param elements - The array to filter.
 * @param predicate - A function that takes an element and its index, and returns
 *   `true` if the element should be included in the filtered array, or `false`
 *   if it should be excluded.
 * @returns Nothing, as the original array is modified in place.
 */
export function filterInPlace<T>(
  elements: T[],
  predicate: (element: T, index: number) => boolean,
): void {
  let tot = 0

  for (let i = 0; i < elements.length; ++i) {
    const el = elements[i]

    if (predicate(el, i)) {
      // Keep the element in the array by overwriting the current position with it,
      // and incrementing the counter.
      // biome-ignore lint/style/noParameterAssign: Filter the caller-owned array in place.
      elements[tot] = el
      tot += 1
    }
  }

  // Set the length of the array to the number of kept elements.
  // biome-ignore lint/style/noParameterAssign: Filter the caller-owned array in place.
  elements.length = tot
}
