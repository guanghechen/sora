# Change Log

## 4.7.8

### Patch Changes

- Refine commander parsing and diagnostics flows by modularizing command stages and internal
  orchestration, while aligning specs and tests with the new structure.

## 4.7.7

### Patch Changes

- Improve preset schema naming consistency and extend envFile preset-path resolution test coverage.
  Stabilize commander test coverage thresholds.

## 4.7.6

### Patch Changes

- Auto-generated release notes:
  - @guanghechen/commander
    - 59f8231 :sparkles: feat(commander): add preset config schema and build-time schema copy
    - 6fc5ee3 :sparkles: feat(commander)!: remove preset suitable restriction
    - 60a6d31 :sparkles: feat(commander): support preset profile variants and manifest presets

## 4.7.5

### Patch Changes

- Fix help output ordering and remove duplicated negative options in help output.

## 4.7.4

### Patch Changes

- Fix commander completion metadata and negative option rules.
  - Include built-in control options (help/version) in completion metadata.
  - Prevent generating negative completions for reserved controls (--no-help/--no-version).
  - Align completion option metadata with explicit type/args semantics.

## 4.7.3

### Patch Changes

- Align commander optional/subcommand parsing with spec and keep release notes in sync. Upgrade
  tooling dependencies and pin changesets packages to fixed versions.

## 4.7.2

### Patch Changes

- Improve commander release quality by enforcing command validation rules and refining fish
  completion command-chain matching.

## 4.7.1

### Patch Changes

- Fix built-in `--version` handling so leaf commands with a configured `version` print their own
  version.

## 4.7.0

### Minor Changes

- Add explicit runtime entry points for browser and node, and align command runtime abstractions and
  tests.

## 4.6.0

### Minor Changes

- Add preset-root and command-level preset resolution for commander, align control/preset pipeline
  behavior with spec, and include updated preset parsing and validation semantics.

## 4.5.1

### Patch Changes

- Add built-in host and network validators (ip, domain, host), expose is helpers, and extend coerce
  factories with port and choice support.

## 4.5.0

### Minor Changes

- Add built-in coerce factories for numeric option parsing in commander.

## 4.4.1

### Patch Changes

- fix(commander): centralize option policy and enforce version flag semantics — subcommands with
  their own `version` now correctly expose `--version`; commands without `version` reject
  `--version` instead of treating it as a boolean option.

## 4.4.0

### Minor Changes

- enforce per-node help subcommand semantics

## 4.3.0

### Minor Changes

- feat: add fluent help examples and styled help renderer

## 4.2.0

### Minor Changes

- feat(reporter): add setFlight API for flight tracking feat(commander): unify builtin config for
  options and commands

### Patch Changes

- Updated dependencies:
  - @guanghechen/reporter@3.3.0

## 4.1.0

### Minor Changes

- ### @guanghechen/reporter
  - feat: add `setLevel` method for dynamic log level change
  - refactor: split source into modular files (`level.ts`, `chalk.ts`, `types.ts`, `reporter.ts`)
  - refactor: move `IReporter` types from `@guanghechen/types` to `@guanghechen/reporter`
  - export: add level utilities (`LogLevelEnum`, `ILogLevel`, `LOG_LEVELS`, `LOG_LEVEL_VALUES`,
    `isLogLevel`, `getLogLevelValue`, `resolveLogLevel`)
  - export: add chalk utilities (`ANSI`, `formatTag`)

  ### @guanghechen/types
  - refactor: remove `IReporter` and `IReporterLevel` exports (moved to `@guanghechen/reporter`)

  ### @guanghechen/commander
  - feat: add predefined options `logLevelOption` and `silentOption` with `apply` callback support
  - refactor: use `ILogLevel` from `@guanghechen/reporter` instead of `IReporterLevel`

  ### Dependent packages
  - chore: bump version for packages depending on `@guanghechen/types`, `@guanghechen/reporter`, or
    `@guanghechen/commander`

### Patch Changes

- Updated dependencies:
  - @guanghechen/reporter@3.2.0

## 4.0.0

### Major Changes

- Breaking changes:
  - Rename `description` field to `desc` in ICommandConfig
  - Implement 5-stage execution flow with breaking API changes
  - Implement ICommandToken for naming convention support with format validation

## 3.3.0

### Minor Changes

- Apply code review fixes:
  - Fix `#getCommandPath` to return full command path (e.g., "cli sub" instead of just "sub")
  - Remove unused `#parseLongOption` and `#parseShortOption` dead code
  - Improve `--no-{option}` help description to "Negate --{option}"
  - Document short option negative value limitation in spec

## 3.2.0

### Minor Changes

- Change args from string[] to Record<string, unknown> with type/coerce/default support:
  - `args` is now `Record<string, unknown>` keyed by argument name
  - Add `rawArgs: string[]` for original argument strings before type conversion
  - IArgument now supports `type`, `default`, and `coerce` properties
  - Add `TooManyArguments` error kind for extra arguments validation

## 3.1.0

### Minor Changes

- Implement option bubbling with shift/apply flow
  - Add `shift()` method for bottom-up option consumption (leaf → root)
  - Refactor `run()` with new flow: route → split → shift → apply → action
  - Add `UnexpectedArgument` error type for positional args before `--`

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 3.0.0 (2026-02-08)

### BREAKING CHANGES

- Change subcommand registration API to `subcommand(name, cmd)`

## 2.1.0 (2026-02-08)

### Features

- Add `--write` option to `CompletionCommand` for direct file output
- Add `help` subcommand support for commands with subcommands
- Detect `--help`/`--version` before parsing to avoid required argument errors
- Add `#normalizeArgv()` preprocessing to simplify `--no-*` option handling
- Add `implements ICommand` for explicit interface implementation

## 2.0.1 (2025-02-07)

### Documentation

- Update README.md

### Miscellaneous

- Add LICENSE file
- Clean up build configs and standardize package exports
- Migrate from lerna to changesets

## 2.0.0 (2025-01-15)

### Features

- Initial stable release: A minimal, type-safe command-line interface builder with fluent API
