# Commander Design

## Scope and Dependency Direction

`guanghechen-commander` provides immutable command trees, deterministic command routing and
parsing, declarative presets, structured diagnostics, help/version controls, and shell completion.
Callers own process arguments, environment acquisition, streams, action dispatch, and exit status.
Commander never reads or mutates global process state, invokes business actions, writes help or
errors, or exits the process.

Commander depends on Chalk for help rendering and Env for preset `.env` parsing. Both dependency
directions are one-way: Commander owns CLI and preset semantics, while Chalk and Env are unaware of
Commander. Commander does not depend on Reporter; callers may apply parsed built-ins to a Reporter
or another logging implementation.

The command tree is built and validated before use, then remains immutable. A node owns its local
definition and children; it has no parent pointer. Cloning a tree shares immutable coercion
functions and copies no runtime state. There is no dynamic plug-in or global runtime registry.

## Definition Contract

A command defines a required name and description, optional version and aliases, local options and
arguments, examples, static subcommands, preset defaults, and built-in policy. Construction rejects
invalid or duplicate names, aliases, and short options; reserved controls; incompatible inherited
overrides; invalid defaults, choices, and coercion shapes; ambiguous positional layouts; and any
node that combines positional arguments with subcommands.

Options use camel-case definition keys and kebab-case CLI names. Long CLI names are
ASCII-case-insensitive; command names, aliases, and short options are case-sensitive. An option has
a value type (`boolean`, `string`, `integer`, or finite `number`), an arity (`none`, `required`,
`optional`, or `variadic`), optional presence requirement, default, choices, and scalar coercion.

- `boolean` accepts only `none`;
- `string` accepts `required`, `optional`, or `variadic`;
- `integer` and `number` accept `required` or `variadic`;
- a presence-required option accepts only `required` arity and has no default;
- an optional option distinguishes absent, present without a value, and present with an empty value;
- scalar options are last-write-wins, while repeated variadics append;
- coercion runs before choices validation and returns the option's declared scalar type;
- coercion validates or normalizes values only and has no context or process side effects.

Primitive numeric syntax accepts signed decimal, fraction, exponent, binary, octal, and hexadecimal
literals with valid embedded underscores. Values must be finite. Integer values must be integral and
representable as `i64`. A numeric value beginning with `-` is accepted only when attached to a long
option, such as `--offset=-1`; a separated `--offset -1` is parsed as option-shaped input and
rejected.

Arguments are required, optional, variadic-zero-or-more, or variadic-one-or-more. Required arguments
precede optional arguments; only the final argument may be variadic. Arguments support choices,
optional defaults, and scalar coercion. An argument default must be scalar, is valid only for an
optional argument, and must be finite when numeric. Raw positional strings remain available beside
converted values.

Options inherit from root to leaf. A descendant may replace an inherited long option only while
preserving value type, arity, presence requirement, and short name. The selected leaf's local option
map is the compatibility view; the parse result also exposes an effective map containing inherited
values because Commander does not use side-effecting `apply` callbacks.

Built-ins are configured independently per command. Help is always reserved; version is available
only when enabled on a versioned command. The extended built-ins are color, devmode, log level,
silent mode, log timestamps, and colorful logging. When devmode is true and log level was not
explicitly supplied, the resolved log level is debug. Built-in values are returned separately from
user-defined option values.

## Input and Parsing Pipeline

Parsing receives explicit argv, an environment snapshot, a base directory, and the maximum terminal
`ColorLevel`. Argv accepts operating-system strings; invalid UTF-8 is a boundary error. Commander
does not call `current_dir`, inspect a TTY, or read `process.env` implicitly.

The single semantic pipeline is:

```text
argv -> route -> control-scan -> preset -> tokenize -> builtin-resolve -> resolve -> parse
```

Routing consumes only the leading consecutive command names or aliases and stops at the first option
or unmatched bare token. Options therefore never precede a subcommand path. Aliases resolve to a
canonical command path while the source ledger preserves the user-spelled route.

Before `--`, `--help` targets the selected command, `help [child]` targets one direct child, and
`--version` targets a selected version-enabled command. Help wins over version. A control returns a
structured help or version outcome before preset validation or I/O. Controls allow missing required
inputs but still reject invalid routes, choices, and extra control arguments. Tokens after `--` are
always positional data.

Tokenization validates long-option syntax, normalizes long names, expands boolean `--no-*`,
preserves the original text for diagnostics, and attaches user or preset source metadata. Short
flags may cluster; a value-taking short option must be last and consumes a following value.
Attached short values and short `=` syntax are rejected. Unknown options and surplus positionals
are errors. Unknown subcommands receive a suggestion only when exactly one high-confidence
candidate exists.

The successful result contains the canonical command path, built-ins, leaf-local options, effective
inherited options, explicit-presence sets, converted and raw arguments, the effective environment,
control state, and immutable source snapshots. Parsing has no retry or rollback because it performs
no caller-visible mutation.

`Debug` output retains environment keys for diagnostics but renders every environment value as
`[REDACTED]` in parse requests, matches, and user or preset source snapshots. Help and version
outcomes inherit the same source redaction. Redaction changes only diagnostic formatting; parsing,
environment accessors, and equality continue to use the original values. Other fields are not
redacted.

## Presets and Environment

`--preset-file` and `--preset-profile <profile[:variant]>` are last-wins directives before `--` and
are removed before ordinary parsing. CLI directives override command defaults, resolved from leaf to
root. An optional configured file may be absent; a CLI-selected or otherwise required file must be a
readable regular file. Resolution continues to the next ancestor after an optional configured file
is absent. A profile selector is invalid unless the same parse resolves a preset file from the CLI
or command defaults.

Preset manifests are UTF-8 JSON, at most 1 MiB, with maximum nesting depth 128 and schema version
`1`. They contain optional defaults and named profiles with `envFile`, inline `envs`, `opts`,
variants, and an optional default variant. Duplicate JSON keys are rejected. Known fields are
type-strict; unknown fields are ignored for forward compatibility. Names start with an ASCII
alphanumeric and then contain only ASCII alphanumerics, `.`, `_`, or `-`.

Selection order is explicit selector, command default, longest canonical command-path suffix,
manifest default, then profile `default`. Profile options are overlaid by variant options and
emitted as attached CLI tokens. Booleans emit positive or negative flags; scalar strings and
numbers emit one token; arrays emit variadic values. Finite numbers use Rust `f64::to_string()`
formatting. Generated tokens cannot become controls, separators, or preset directives. Preset argv
precedes user argv, so user scalar values override and user variadics append.

Manifest paths resolve from the explicit parse base directory; env-file paths resolve from the
manifest directory. Only selected env files are read, each with the same 1 MiB bound. Environment
precedence is caller environment, profile file, profile inline values, variant file, then variant
inline values. Env files are parsed by `guanghechen-env` with declaration-order interpolation:
only entries defined earlier in the same file are visible, and unknown or forward references become
empty strings. Keys follow `[A-Za-z_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?`, so `.` and `-` are literal
internal name characters. Comments, `export`, single and double quotes, standard double-quote
escapes, and escaped references are supported. Single- and double-quoted values may span physical
lines; line endings normalize to LF. Single-quoted and escaped references remain literal. Empty or
unclosed interpolation-shaped text is not a reference and also remains literal.

An unclosed quote aborts preset parsing and identifies the environment file, key, and physical line
where the declaration started. Each preset env file uses explicit 1 MiB limits for source bytes,
one expanded value, and total expanded values, so interpolation cannot amplify the bounded file
into an unbounded allocation. A limit failure identifies the file, key when applicable, and maximum
without including source values. Diagnostics never include the source line or environment value.
Commander returns the overlay and effective environment without mutating the caller's environment;
environment acquisition remains caller-owned and no preset path reads process-global environment.

The source ledger records clean user argv, canonical and user-spelled command paths, preset state
(`skipped`, `none`, or `applied`), generated argv, environment overlay, and selected file/profile/
variant metadata. A control short-circuit records preset state as `skipped`.

## Help, Version, and Color

Help data is structured before rendering. It contains usage, arguments, options, preset directives,
commands and aliases, and examples. Stable ordering places help, version, required options, and
other options in their documented groups. Defaults and choices appear in descriptions. Column
alignment uses terminal display width after removing ANSI and accounts for combining and wide
characters.

Plain help is deterministic and contains no ANSI. Styled help uses Chalk and the explicit maximum
`ColorLevel`. `NO_COLOR`, `--no-color`, or `ColorLevel::None` selects plain output; an explicit
`--color` overrides `NO_COLOR` but cannot exceed the supplied maximum capability. Commander performs
no terminal detection. Version output is `<canonical command path> <version>` with one trailing
newline.

## Completion

Completion metadata derives from the same immutable tree, effective option policy, aliases,
cardinality, and choices as parsing. The reusable `completion` command requires exactly one of
`--bash`, `--fish`, or `--pwsh`. `--write[=<path>]` selects an explicit or shell-specific default
file. Candidate-query tokens must follow `--` and cannot combine with write mode.

Generated Bash, Fish, and PowerShell scripts delegate runtime candidate routing to Commander rather
than duplicating the grammar statically. Candidate generation understands nested aliases, inherited
options, negative booleans, option arity, argument slots, choices, the separator, and cursor-scoped
Bash input. A candidate query emits one UTF-8 record per line: the candidate, followed by a tab and
a non-empty description when one exists. Long, short, and negative option forms share the option
description; canonical subcommand names and aliases share the command description; choices have no
description. Candidates containing NUL, tab, carriage return, or newline are omitted, while those
characters in descriptions are normalized to spaces. Bash consumes only the candidate field; Fish
shows the description beside the candidate; PowerShell uses it as the completion tooltip. Program
names, descriptions, paths, and candidates are quoted as data for the target shell.

Default files are dedicated completion files rather than shared shell profiles:

- Bash: `~/.local/share/bash-completion/completions/<program>`;
- Fish: `~/.config/fish/completions/<program>.fish`;
- PowerShell: `~/.config/pwsh/completions/<program>.ps1`.

Generation and candidate lookup are pure. Home expansion requires an explicit home directory.
Callers resolve that directory from their original OS-native user environment rather than a preset
environment overlay, so a preset cannot redirect completion installation and non-UTF-8 home paths
remain usable.
Writing creates missing parent directories and replaces the target through a same-directory
temporary file; I/O errors retain their original source with actionable path context. Commander
never installs completion implicitly.

## Diagnostics and Failure

Definition, parse, preset, and completion errors retain stable kinds, canonical command path, and a
normalized issue list. Every issue contains kind (`error` or `hint`), stage, scope, reason code and
message, optional origin stage, source attribution, and preset location. The unique primary error is
always `issues[0]`; later entries are hints. User/preset mixed-source conflicts retain both sources.
Preset-originated parse errors identify the selected file, profile, variant, and option when known.

Diagnostic stages are `definition`, `route`, `control-scan`, `preset`, `tokenize`,
`builtin-resolve`, `resolve`, `parse`, and `completion`. Scopes are `control`, `preset`, `option`,
`argument`, `command`, `completion`, and `runtime`. Stable primary reason codes are:

- `configuration_error` and `invalid_unicode`;
- `invalid_option_format`, `invalid_negative_option`, `negative_option_with_value`, and
  `negative_option_type`;
- `unknown_option`, `missing_value`, `invalid_type`, `unsupported_short_syntax`,
  `option_conflict`, `missing_required`, `invalid_choice`, and `invalid_boolean_value`;
- `unknown_subcommand`, `unexpected_argument`, `missing_required_argument`, and
  `too_many_arguments`;
- `completion_error` and `io_error`.

Stable hint codes are `preset_token_injected`, `mixed_source_conflict`,
`did_you_mean_subcommand`, and `command_does_not_accept_positional_arguments`. Error reason codes
appear only on the primary issue; hint reason codes appear only on hints. Empty source attribution
is omitted. Preset metadata is present only when preset is a related source and is mandatory when
preset is the primary source.

Rendering consumes normalized issues without inferring semantics:

```text
Error: <message>
Hint: <optional hint>
Run "<command path> --help" for usage.
```

Definition and input failures abort with no partial result. Optional missing preset files degrade to
no preset; every other preset failure aborts. Completion generation never fails after valid
metadata; completion parsing and I/O failures abort. Commander never retries, writes fallback
output, redirects streams, or assigns a process exit code.

There are no blocking open design questions.

## Verification

Tests cover definition invariants; route and alias semantics; controls; option and argument grammar;
numeric forms and coercion; inherited/local result views; built-in resolution; source-attributed
diagnostics; preset selection, bounds, precedence, and Env-backed key, multiline, interpolation, and
value-redacted failure semantics, including adversarial expansion chains; plain and styled help
including Unicode alignment; deterministic version output; Bash/Fish/PowerShell generation and
quoting; dynamic candidate routing; link-safe completion replacement; invalid UTF-8; and failure
propagation. Debug-formatting tests verify that environment values are redacted across requests,
matches, source snapshots, help outcomes, and version outcomes while environment keys remain
visible.
