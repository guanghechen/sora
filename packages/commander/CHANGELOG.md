# Change Log

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
