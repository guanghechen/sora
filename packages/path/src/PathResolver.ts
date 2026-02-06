import type { IPathResolver, IPathResolverParams } from '@guanghechen/types'
import path from 'node:path'

const clazz: string = 'PathResolver'

export class PathResolver implements IPathResolver {
  protected readonly defaultPreferSlash: boolean

  constructor(params: IPathResolverParams = {}) {
    this.defaultPreferSlash = params.preferSlash ?? false
  }

  public basename(filepath: string): string {
    this.ensureAbsolute(filepath)
    const p: string = this.normalize(filepath)
    return path.basename(p)
  }

  public ensureAbsolute(filepath: string, message?: string | undefined): void | never {
    if (this.isAbsolute(filepath)) return
    throw new Error(message ?? `[${clazz}] not an absolute path: ${filepath}.`)
  }

  public ensureSafeRelative(
    root: string,
    filepath: string,
    message?: string | undefined,
  ): void | never {
    if (this.isSafeRelative(root, filepath)) return
    throw new Error(
      message ?? `[${clazz}] not under the root path: filepath ${filepath}, root: ${root}.`,
    )
  }

  public dirname(filepath: string): string | never {
    this.ensureAbsolute(filepath)
    const p: string = path.dirname(filepath)
    return this.normalize(p)
  }

  public isAbsolute(filepath: string): boolean {
    return path.isAbsolute(filepath)
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
    const p: string = path.join(filepath, ...pathPieces)
    return this.normalize(p)
  }

  public normalize(filepath: string): string | never {
    this.ensureAbsolute(filepath)
    return this._internalNormalize(filepath)
  }

  public relative(from: string, to: string, preferSlash_?: boolean): string | never {
    const preferSlash: boolean = preferSlash_ ?? this.defaultPreferSlash
    this.ensureAbsolute(from, `[${clazz}.relative] from is not an absolute path: ${from}`)
    this.ensureAbsolute(to, `[${clazz}.relative] to is not an absolute path: ${to}`)
    const relativePath: string = this._internalRelative(from, to)
    return preferSlash ? relativePath.replaceAll('\\', '/') : relativePath
  }

  public safeRelative(root: string, filepath: string, preferSlash_?: boolean): string {
    const preferSlash: boolean = preferSlash_ ?? this.defaultPreferSlash
    this.ensureSafeRelative(root, filepath)
    const relativePath: string = this._internalSafeRelative(root, filepath)
    return preferSlash ? relativePath.replaceAll('\\', '/') : relativePath
  }

  public safeResolve(root: string, filepath: string): string {
    this.ensureSafeRelative(root, filepath)
    return this._internalSafeResolve(root, filepath)
  }

  protected _internalNormalize(filepath: string): string {
    const p: string = path
      .normalize(filepath)
      .replace(/[/\\]+/g, path.sep)
      .replace(/[/\\]+$/, '')
    return p.length <= 0 ? '/' : p
  }

  protected _internalRelative(from_: string, to_: string): string {
    const from: string = this.normalize(from_)
    const to: string = this.normalize(to_)
    const relativePath: string = path.relative(from, to)
    return relativePath
  }

  protected _internalSafeRelative(root_: string, filepath_: string): string {
    const root: string = this._internalNormalize(root_)
    const filepath: string = this._internalSafeResolve(root, filepath_)
    const relativePath: string = this._internalRelative(root, filepath)
    return relativePath
  }

  protected _internalSafeResolve(root: string, filepath_: string): string {
    const filepath: string = this.isAbsolute(filepath_) ? filepath_ : path.join(root, filepath_)
    return this._internalNormalize(filepath)
  }
}
