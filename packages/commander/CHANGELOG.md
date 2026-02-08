# Change Log

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
