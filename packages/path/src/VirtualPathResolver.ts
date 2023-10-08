import type { IPathResolver } from '@guanghechen/path.types'

const clazz: string = 'VirtualPathResolver'

export class VirtualPathResolver implements IPathResolver {
  public basename(filepath: string): string {
    this.ensureAbsolute(filepath)
    const p: string = this.normalize(filepath)
    const i: number = p.lastIndexOf('/')
    return p.slice(i + 1)
  }

  public ensureAbsolute(filepath: string, message?: string | undefined): void | never {
    if (this.isAbsolute(filepath)) return
    throw new Error(message ?? `[${clazz}] not an absolute path: ${filepath}.`)
  }

  public dirname(filepath: string): string | never {
    this.ensureAbsolute(filepath)
    const p: string = this.normalize(filepath)
    const i: number = p.lastIndexOf('/')
    return i <= 0 ? '/' : p.slice(0, i)
  }

  public isAbsolute(filepath: string): boolean {
    return filepath.startsWith('/') || filepath.startsWith('\\')
  }

  public join(filepath: string, ...pathPieces: string[]): string | never {
    this.ensureAbsolute(filepath, `[${clazz}.join] not an absolute path: ${filepath}.`)
    for (const pathPiece of pathPieces) {
      if (this.isAbsolute(pathPiece)) {
        throw new Error(`[${clazz}.join] pathPiece shouldn't be absolute path. ${pathPiece}`)
      }
    }
    const p: string = filepath + '/' + pathPieces.join('/')
    return this.normalize(p)
  }

  public normalize(filepath: string): string | never {
    this.ensureAbsolute(filepath)
    const pieces: string[] = []
    for (const piece of filepath.split(/[/\\]+/g)) {
      if (!piece) continue
      if (piece === '.') continue
      if (piece === '..') {
        pieces.pop()
        continue
      }
      pieces.push(piece)
    }
    return '/' + pieces.join('/')
  }

  public relative(from_: string, to_: string): string | never {
    this.ensureAbsolute(from_, `[${clazz}.relative] from is not an absolute path: ${from_}`)
    this.ensureAbsolute(to_, `[${clazz}.relative] to is not an absolute path: ${to_}`)
    const from: string = this.normalize(from_)
    const to: string = this.normalize(to_)
    const fromPieces: string[] = from.split('/')
    const toPieces: string[] = to.split('/')

    let ci: number = 0
    const L: number = fromPieces.length < toPieces.length ? fromPieces.length : toPieces.length
    for (; ci < L; ++ci) {
      if (fromPieces[ci] !== toPieces[ci]) break
    }
    return '../'.repeat(fromPieces.length - ci) + toPieces.slice(ci).join('/')
  }
}
