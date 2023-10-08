import type { IPathResolver } from '@guanghechen/path.types'
import path from 'node:path'

const clazz: string = 'PhysicalPathResolver'

export class PhysicalPathResolver implements IPathResolver {
  public basename(filepath: string): string {
    this.ensureAbsolute(filepath)
    const p: string = this.normalize(filepath)
    return path.basename(p)
  }

  public ensureAbsolute(filepath: string, message?: string | undefined): void | never {
    if (this.isAbsolute(filepath)) return
    throw new Error(message ?? `[${clazz}] not an absolute path: ${filepath}.`)
  }

  public dirname(filepath: string): string | never {
    this.ensureAbsolute(filepath)
    const p: string = path.dirname(filepath)
    return this.normalize(p)
  }

  public isAbsolute(filepath: string): boolean {
    return path.isAbsolute(filepath)
  }

  public join(filepath: string, ...pathPieces: string[]): string | never {
    this.ensureAbsolute(filepath, `[${clazz}.join] not an absolute path: ${filepath}.`)
    for (const pathPiece of pathPieces) {
      if (this.isAbsolute(pathPiece)) {
        throw new Error(`[${clazz}.join] pathPiece shouldn't be absolute path. ${pathPiece}`)
      }
    }
    const p: string = path.join(filepath, ...pathPieces)
    return this.normalize(p)
  }

  public normalize(filepath: string): string | never {
    this.ensureAbsolute(filepath)
    const p: string = path
      .normalize(filepath)
      .replace(/[/\\]+/g, path.sep)
      .replace(/[/\\]+$/, '')
    return p.length <= 0 ? '/' : p
  }

  public relative(from_: string, to_: string): string | never {
    this.ensureAbsolute(from_, `[${clazz}.relative] from is not an absolute path: ${from_}`)
    this.ensureAbsolute(to_, `[${clazz}.relative] to is not an absolute path: ${to_}`)
    const from: string = this.normalize(from_)
    const to: string = this.normalize(to_)
    const relativePath: string = path.relative(from, to)
    return relativePath
  }
}
