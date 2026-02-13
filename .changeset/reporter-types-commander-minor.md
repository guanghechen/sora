---
"@guanghechen/reporter": minor
"@guanghechen/types": minor
"@guanghechen/commander": minor
"@guanghechen/config": minor
"@guanghechen/disposable": minor
"@guanghechen/eventbus": minor
"@guanghechen/observable": minor
"@guanghechen/path": minor
"@guanghechen/resource": minor
"@guanghechen/scheduler": minor
"@guanghechen/subscriber": minor
"@guanghechen/task": minor
"@guanghechen/viewmodel": minor
---

### @guanghechen/reporter

- feat: add `setLevel` method for dynamic log level change
- refactor: split source into modular files (`level.ts`, `chalk.ts`, `types.ts`, `reporter.ts`)
- refactor: move `IReporter` types from `@guanghechen/types` to `@guanghechen/reporter`
- export: add level utilities (`LogLevelEnum`, `ILogLevel`, `LOG_LEVELS`, `LOG_LEVEL_VALUES`, `isLogLevel`, `getLogLevelValue`, `resolveLogLevel`)
- export: add chalk utilities (`ANSI`, `formatTag`)

### @guanghechen/types

- refactor: remove `IReporter` and `IReporterLevel` exports (moved to `@guanghechen/reporter`)

### @guanghechen/commander

- feat: add predefined options `logLevelOption` and `silentOption` with `apply` callback support
- refactor: use `ILogLevel` from `@guanghechen/reporter` instead of `IReporterLevel`

### Dependent packages

- chore: bump version for packages depending on `@guanghechen/types`, `@guanghechen/reporter`, or `@guanghechen/commander`
