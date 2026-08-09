# Env Design

## Scope

`guanghechen-env` is a zero-dependency `.env` parser, serializer, and recursive resolver. The pure
parser and resolver do not inspect process-global environment state. `resolve_upward_files` is a
thin, explicit filesystem adapter over the same resolver contract.

## Public contract

- `parse` retains `@guanghechen/env` declaration-order interpolation. Only declarations already
  seen in the same source are visible; unknown references become empty strings. Keys follow
  `[A-Za-z_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?`: dot and dash are literal key-name characters and
  never imply a nested key path.
- Single- and double-quoted values may span physical lines. Line endings normalize to LF. Single
  quotes preserve content literally; double quotes process escapes and interpolation after the
  closing quote is found. Comment markers inside either quoted form are value content.
- `stringify` emits deterministic key order because `EnvRecord` is a `BTreeMap`. It rejects keys
  outside the parser grammar rather than emitting records that would be dropped on reload. Values
  requiring escaping, containing whitespace, single quotes, or `#`, or resembling interpolation
  tokens are encoded so that `parse(stringify(env))` preserves the record.
- `resolve` parses one source and resolves the final declaration graph, so forward and transitive
  references are supported.
- `resolve_upward` receives sources from nearest to farthest. Within one source, the last
  declaration of a key wins. Across sources, the nearest source declaring a key wins.
- `resolve_upward_files` accepts prioritized file names, a starting directory, and an optional root
  directory. It canonicalizes the directories, then walks physical
  ancestors from nearest to farthest. Within each directory, file names are read in caller-provided
  priority order. The optional root directory is inclusive; `None` walks to the filesystem or
  Windows volume root. Missing files are skipped. The root controls search termination, not target
  containment; candidate symlinks are followed, so callers own filesystem trust and secure source
  acquisition when processing an untrusted tree.
- The existing `parse`, `resolve`, `resolve_upward`, and `resolve_upward_files` functions retain
  their unbounded trusted-input contract. Their `*_with_limits` peers require explicit
  `EnvLimits` and enforce four UTF-8 byte budgets: one source, all sources, one expanded value, and
  all expanded values. `EnvLimits::new(maximum_bytes)` initializes every budget to the same value;
  individual builders may override it. A bounded function checks source budgets before parsing and
  computes an expanded value's size before allocating it.

For declaration-order `parse_with_limits`, the total expanded-value budget charges every rendered
declaration, including a value later overwritten by another declaration of the same key. For graph
resolution, it charges each selected declaration once. This makes the limit a bound on work and
allocation rather than only the final record size. File-backed bounded resolution caps each read
and the cumulative loaded source bytes before parsing. Recursive-resolution topology edges borrow
selected declaration keys instead of copying key text per edge, so key length and dependency
fan-out cannot multiply graph-owned string bytes.

Recursive resolution has two distinct phases:

1. Select exactly one declaration for each key using source priority.
2. Resolve references against the selected declaration graph.

This ordering is intentional. Given parent `A=${B}` and grandparent `A=${C}`, the selected
declaration is `A=${B}`; the discarded grandparent declaration cannot add a dependency on `C` or
introduce a cycle.

Single-quoted values and escaped references such as `\${NAME}` are literals and therefore do not
create graph edges. References without a selected declaration resolve to an empty string, matching
`parse` compatibility behavior.

File names are constrained to one relative path component, so every candidate pathname is formed
within the directory currently being searched. Opening that pathname follows symlinks and may reach
a target outside the search root. Directory distance always outranks file-name priority. For
example, the lowest-priority file in the current directory still outranks the highest-priority file
in its parent directory.

## Failure strategy

An unclosed quote aborts parsing and reports the physical line where the declaration started. The
default error retains only that line number and environment key; source values are never included in
`Display` or `Debug`. `resolve_upward` reports the zero-based source index so callers can attach
their own path or layer metadata. Any cycle in the selected declaration graph aborts the entire
resolution and returns the closed cycle path, for example `A -> B -> A`; partial values are never
returned. A bounded operation aborts before exceeding a configured budget and reports only the
limit kind, maximum, source index or file path when applicable, and environment key for a value
limit; source values are never retained. Invalid UTF-8 file errors retain only the invalid sequence
offset and length, not the loaded bytes. Stringification rejects invalid keys with `StringifyError`
before emitting them. File resolution attaches the candidate path to I/O, parse, and source-limit
errors, rejects non-directory search boundaries, and rejects a root directory that is not an
ancestor of the starting directory.
