# CLI Reporter Design

## Scope

`guanghechen-cli-reporter` is the one-shot CLI composition layer between
`guanghechen-commander` and `guanghechen-reporter`. It converts Commander builtin matches into one
buffered Reporter, exposes the effective terminal/color policy to command-local renderers, and owns
the final error-record and flush lifecycle. It has no command surface and does not read process
arguments, environment variables, TTY state, or global stdio directly.

The crate does not own command definitions, domain output layout, process-global long-running
reporters, file path presentation, retries, rollback, or application-specific exit codes. File path
presentation belongs to Chalk. Domain commands remain the sole owners of stdout machine data and
semantic success output.

## Dependencies and Data Flow

The crate depends on Commander and Reporter as peer foundations:

```text
Commander matches ─┐
                   ├─ CLI Reporter ─→ caller-owned writers and exit code
Reporter core ─────┘
```

Reporter remains unaware of Commander, and Commander remains unaware of Reporter. CLI Reporter does
not depend on an application or root CLI, so standalone and integrated commands can share the same
entrypoint contract without reverse dependencies.

## Reporter Configuration

`CliReporter::from_matches` requires Commander builtin `logLevel` and reads `silent`, `logDate`, and
`logColorful`. `silent` raises the minimum level to `error`. Date follows the resolved Commander
builtin. Default color is enabled only when every possible destination supplied by the caller is a
terminal and the effective environment does not contain `NO_COLOR`. An explicit Commander
`logColorful` value overrides the terminal and `NO_COLOR` default policy.

The caller supplies a validated reporter prefix and the combined terminal state of every possible
destination. CLI Reporter does not infer either value. `terminal()` and `colorful()` expose the
effective state for command-local semantic renderers.

## Output Ownership

Each `CliReporter` owns one thread-safe bounded byte buffer shared by both message channels. Records
retain Reporter-formatted parts, separate parts with one ASCII space, and end with LF. The default
`info`, `warn`, and `error` methods visibly escape message controls before buffering. This keeps
ordinary and untrusted messages on one physical line and prevents their controls from reaching
terminal-facing output.

`info_rendered` and `warn_rendered` are an explicit trusted channel for command-local semantic
renderers. They preserve the renderer's complete message, including multiline layout, SGR styling,
and OSC 8 hyperlinks. Callers must pass only fully sanitized renderer-owned output; raw arguments,
environment values, file contents, remote responses, and other untrusted strings must not enter this
channel unless the semantic renderer has made every interpolation terminal-safe. The ordinary
methods remain the safe default, and `run_reported` terminal errors always use the escaped channel.

Both channels apply the same Reporter level, prefix, date, and color configuration and serialize
into the same buffer, preserving filtering and cross-channel call order. The buffer limit is 64 MiB.
Size overflow, poisoned locking, and output errors propagate as I/O failures. `flush_to` atomically
takes the current buffer and writes it to a caller-provided writer; successful repeated flushes emit
only newly buffered records. Other Reporter capabilities stay on Reporter itself until a real
one-shot CLI consumer requires them.

## Entrypoint Lifecycle

`run_reported` constructs the reporter, invokes one synchronous action, maps an action error through
the caller's exit-code function, writes one terminal error record, and finally flushes the buffer.
Reporter construction or final writer failure returns exit code `1`. A successful action returns
`0` after flush.

`run_reported_with_disposition` additionally accepts `TerminalErrorDisposition`. `Report` emits the
terminal error record; `Suppress` omits only that final record while preserving the action-derived
non-zero exit code and flushing previously buffered output. This supports commands that have already
rendered a complete semantic failure without relying on empty-message conventions.

If the terminal error record cannot enter a non-empty buffer, the runner flushes the accumulated
records once and retries the terminal error against the empty buffer. A retry failure or any writer
failure returns exit code `1`; records successfully flushed before that failure remain delivered.

An emitted terminal error begins with exactly one `Error:` marker. Repeated leading markers are
collapsed, an absent marker is added, and an otherwise empty message becomes `Error:`. Remaining
message content is unchanged.

## Failure Strategy and Open Questions

The adapter never retries or rolls back a completed action. Reporter or writer failure changes the
process result to failure but cannot undo domain side effects. The action is synchronous; process
cancellation and long-running lifecycle ownership remain application concerns.

There are no blocking open design questions.

## Verification

Tests cover buffer drain, shared ordering and bound enforcement, Reporter formatting,
terminal/default/explicit color, `NO_COLOR`, effective style exposure, date and silent controls,
visible escaping of ordinary and terminal-error messages, preservation of trusted multiline SGR and
OSC 8 output, action exit-code mapping, exact error marker normalization, explicit terminal-record
suppression, full-buffer terminal-error retry, and final writer failure.
