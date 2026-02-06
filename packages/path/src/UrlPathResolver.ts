import type { IPathResolver } from '@guanghechen/types'

const clazz = 'UrlPathResolver'

export class UrlPathResolver implements IPathResolver {
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

  public ensureSafeRelative(root: string, filepath: string, message?: string | undefined): void {
    if (this.isSafeRelative(root, filepath)) return
    throw new Error(
      message ?? `[${clazz}] not under the root path: filepath ${filepath}, root: ${root}.`,
    )
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

  public isSafeRelative(root: string, filepath: string): boolean {
    if (!this.isAbsolute(root)) return false
    const relativePath: string = this._internalSafeRelative(root, filepath)
    return !relativePath.startsWith('..')
  }

  public join(filepath: string, ...pathPieces: string[]): string | never {
    this.ensureAbsolute(filepath, `[${clazz}.join] not an absolute path: ${filepath}.`)
    for (const pathPiece of pathPieces) {
      if (this.isAbsolute(pathPiece)) {
        throw new Error(`[${clazz}.join] pathPiece shouldn't be absolute path. ${pathPiece}`)
      }
    }
    return this._internalJoin(filepath, pathPieces.join('/'))
  }

  public normalize(filepath: string): string | never {
    this.ensureAbsolute(filepath)
    return this._internalNormalize(filepath)
  }

  public relative(from: string, to: string): string | never {
    this.ensureAbsolute(from, `[${clazz}.relative] from is not an absolute path: ${from}`)
    this.ensureAbsolute(to, `[${clazz}.relative] to is not an absolute path: ${to}`)
    return this._internalRelative(from, to)
  }

  public safeRelative(root: string, filepath: string): string {
    this.ensureSafeRelative(root, filepath)
    return this._internalSafeRelative(root, filepath)
  }

  public safeResolve(root: string, filepath: string): string {
    this.ensureSafeRelative(root, filepath)
    return this._internalSafeResolve(root, filepath)
  }

  protected _internalJoin(root: string, relativePath: string): string {
    const filepath: string = root + '/' + relativePath
    return this._internalNormalize(filepath)
  }

  protected _internalNormalize(filepath: string): string {
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

  protected _internalRelative(from_: string, to_: string): string {
    const from: string = this.normalize(from_)
    const to: string = this.normalize(to_)
    const fromPieces: string[] = from.split('/')
    const toPieces: string[] = to.split('/')

    let ci = 0
    const L: number = fromPieces.length < toPieces.length ? fromPieces.length : toPieces.length
    for (; ci < L; ++ci) {
      if (fromPieces[ci] !== toPieces[ci]) break
    }
    return '../'.repeat(fromPieces.length - ci) + toPieces.slice(ci).join('/')
  }

  protected _internalSafeRelative(root_: string, filepath_: string): string {
    const root: string = this._internalNormalize(root_)
    const filepath: string = this._internalSafeResolve(root, filepath_)
    const relativePath: string = this._internalRelative(root, filepath)
    return relativePath
  }

  protected _internalSafeResolve(root: string, filepath_: string): string {
    const filepath: string = this.isAbsolute(filepath_) ? filepath_ : this.join(root, filepath_)
    return filepath
  }
}
