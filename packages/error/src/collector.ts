import type { ISoraError, ISoraErrorCollector } from './types'
import { SoraErrorLevel } from './types'

export class SoraErrorCollector implements ISoraErrorCollector {
  public readonly name: string
  private readonly _errors: ISoraError[]

  constructor(name: string) {
    this.name = name
    this._errors = []
  }

  public get size(): number {
    return this._errors.length
  }

  public get errors(): ISoraError[] {
    return this._errors.slice()
  }

  public add(from: string, error: unknown, level: SoraErrorLevel = SoraErrorLevel.ERROR): void {
    this._errors.push({ from, level, details: error })
  }

  public merge(collector: ISoraErrorCollector): void {
    this._errors.push(...collector.errors)
  }

  public cleanup(): void {
    this._errors.length = 0
  }
}
