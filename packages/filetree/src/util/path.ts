const regex = /[/\\]+/g

/**
 * Split the pathFromRoot into path pieces.
 * @param path
 * @returns
 */
export function splitPathFromRoot(path: string): string[] {
  if (path.startsWith('/') || path.startsWith('\\')) {
    throw new TypeError(`[splitPathFromRoot] pathFromRoot should be a relative path (${path}).`)
  }

  const rawPieces: string[] = path.split(regex)
  const pieces: string[] = []
  for (const piece of rawPieces) {
    if (piece.length <= 0) continue
    if (piece === '.') continue
    if (piece === '..') pieces.pop()
    else pieces.push(piece)
  }
  return pieces
}
