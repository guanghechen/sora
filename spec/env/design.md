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
  Windows volume root. Missing files are skipped.

Recursive resolution has two distinct phases:

1. Select exactly one declaration for each key using source priority.
2. Resolve references against the selected declaration graph.

This ordering is intentional. Given parent `A=${B}` and grandparent `A=${C}`, the selected
declaration is `A=${B}`; the discarded grandparent declaration cannot add a dependency on `C` or
introduce a cycle.

Single-quoted values and escaped references such as `\${NAME}` are literals and therefore do not
create graph edges. References without a selected declaration resolve to an empty string, matching
`parse` compatibility behavior.

File names are constrained to one relative path component so every candidate remains in the
directory currently being searched. Directory distance always outranks file-name priority. For
example, the lowest-priority file in the current directory still outranks the highest-priority file
in its parent directory.

## Failure strategy

An unclosed quote aborts parsing and reports the physical line where the declaration started. The
default error retains only that line number and environment key; source values are never included in
`Display` or `Debug`. `resolve_upward` reports the zero-based source index so callers can attach
their own path or layer metadata. Any cycle in the selected declaration graph aborts the entire
resolution and returns the closed cycle path, for example `A -> B -> A`; partial values are never
returned. Stringification rejects invalid keys with `StringifyError` before emitting them. File
resolution attaches the candidate path to I/O and parse errors, rejects non-directory search
boundaries, and rejects a root directory that is not an ancestor of the starting directory.
