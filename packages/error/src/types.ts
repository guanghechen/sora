export enum SoraErrorLevel {
  FATAL = 'FATAL',
  ERROR = 'ERROR',
  WARN = 'WARN',
}

export interface ISoraError {
  from: string
  level: SoraErrorLevel
  details: unknown
}

export interface ISoraErrorCollector {
  readonly name: string
  readonly size: number
  readonly errors: ISoraError[]
  add(from: string, error: unknown, level?: SoraErrorLevel): void
  merge(collector: ISoraErrorCollector): void
  cleanup(): void
}
