# Commander Unification Notes

This file records how the Rust Commander contract is unified with `../sora/packages/commander`.
The final contract is defined only by `design.md`.

## Adopt from Sora

- leading-path routing: options cannot precede subcommands;
- attached-only negative numeric option values;
- required options and scalar coercion before choices validation;
- fine-grained built-in policy and devmode/log-level resolution;
- separate built-in, leaf-local, and positional parse views;
- structured stages, issues, source attribution, and preset provenance;
- examples, help metadata, color policy, and Unicode-aware display alignment;
- explicit environment input and effective environment/source snapshots;
- richer preset profile and variant diagnostics.

## Keep from Rust

- immutable, parent-free command trees validated at build time;
- pure parsing with caller-owned actions, streams, environment mutation, and exit status;
- `OsString` input validation and a distinct `Integer` value type;
- preset file-size and JSON-depth bounds, duplicate-key rejection, and deterministic parsing;
- runtime completion queries driven by the parsing metadata;
- dedicated completion files, explicit home input, and temporary-file replacement;
- one-way Commander-to-Chalk and Commander-to-Env dependencies, with no Commander-to-Reporter
  dependency.

## Reject from Commander Core

- mutable command nodes and parent pointers;
- `action`, `run`, console output, and process exit ownership;
- side-effecting option `apply` callbacks;
- default or global Reporter instances;
- global runtime registries and implicit current-directory, environment, or TTY reads;
- browser/node entry splits, which are JavaScript packaging concerns;
- static completion scripts that duplicate routing logic;
- writing into a shared PowerShell profile by default.

## Resolved Compatibility Changes

The new Rust crate adopts the finalized `kit-rust/crates/commander` contract. Its initial release
has no existing `sora-rust` consumers, so the unified behavior is introduced without a compatibility
layer.

- `pm --verbose start` stops at `pm`; use `pm start --verbose`.
- `--offset -1` is rejected; use `--offset=-1`.
- the leaf-local option map no longer silently contains every inherited option; callers use the
  effective view when they need inherited values.
- help formatting becomes structured and may use Chalk when color is explicitly enabled.
- parse errors gain normalized issue metadata while keeping deterministic text rendering.
- environment values are redacted from `Debug` output while remaining available through accessors.
- preset env files use the shared `guanghechen-env` declaration-order parser, including its key,
  multiline quote, interpolation, and value-redacted error contracts.
- completion queries emit candidate/description records for shell-native help text.
- preset numbers use Rust-native finite-number formatting without a separate formatter dependency.

The in-scope consumer migration remains owned and verified by the `kit-rust` repository rather than
being duplicated in `sora-rust`.
