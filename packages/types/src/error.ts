import type { ErrorLevelEnum } from '@guanghechen/constant'

export interface ISoraError {
  from: string
  level: ErrorLevelEnum
  details: unknown
}

export interface ISoraErrorCollector {
  readonly name: string
  readonly size: number
  readonly errors: ISoraError[]
  add(from: string, error: unknown, level?: ErrorLevelEnum): void
  merge(collector: ISoraErrorCollector): void
  cleanup(): void
}
