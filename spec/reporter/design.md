# Reporter Design

## Scope

`guanghechen-reporter` is the thread-safe reporting foundation for runtime level,
immutable prefix contexts, date, color, output, and generation-scoped test capture. File lifecycle,
rotation, remote transport, JSON output, and custom formatter pipelines are caller concerns.

Reporter depends on Chalk for ANSI rendering. The dependency is one-way: Reporter owns logging and
color policy, while Chalk remains unaware of Reporter and process state.

## Public Contract

`LogLevel` is `Debug < Info < Hint < Warn < Error`. Exact parsing accepts lowercase names;
`resolve_log_level` is ASCII-case-insensitive. A record is enabled at or above the current threshold.

`Reporter` supports construction, level/flight updates, immutable prefix derivation through
`with_prefix`, eager/lazy logging, level helpers, and capture through `mock`/`collect`. A derived or
cloned reporter owns its prefix chain and shares the runtime core with its source reporter. Level,
flight, capture, and output are therefore shared by every related reporter, while prefix chains remain
isolated. `ReporterFlight` updates date/color only when present and retains omitted
values; both default to enabled. Color-disabled formatting selects `ColorLevel::None`; color-enabled
formatting explicitly selects `ColorLevel::Ansi16`. Reporter does not ask Chalk to detect terminal
capability. Reporter exposes semantic formatting operations rather than raw ANSI escape constants.
Prefix components cannot contain `:`. Lazy messages run only after filtering.

Without a custom sink, debug/info/hint use stdout and warn/error use stderr. Every record ends with one
newline; embedded message newlines are preserved. Output errors propagate unchanged. Capture bypasses
the sink and records level, context prefixes, resolved message, and time. `collect` ends the shared
capture and is empty when capture is inactive. It is not a barrier: callers must quiesce or join log
producers first. A record that began in a capture but finishes after that capture ends is discarded.

## Formatting

Dates are UTC ISO-8601 milliseconds. Prefixes join with `:`; without prefixes, the lowercase level is
the tag.

```text
2026-07-31T12:34:56.789Z [app:worker] connected
[warn] retrying
```

Color affects only timestamp/tag bytes; message bytes are untouched. Colors are gray debug, cyan info,
magenta hint, yellow warn, red error, with gray delimiters and timestamps. Chalk renders nested tag
colors with property-specific close and reopen sequences rather than blanket resets.

## Concurrency and Failure

An immutable prefix chain belongs to each reporter handle. Related handles share one core containing
the output and one mutex-protected state for threshold, flight values, and capture. Formatting and sink
I/O happen after unlock; sink calls may run concurrently, and concurrent records have no total ordering
guarantee. A capture generation prevents an old in-flight record from entering a later capture
session. Poisoning recovers the contained state.

Creating a prefixed context either succeeds without changing its source or returns an error. Filtered
records do no work; output is never retried or redirected. Pre-Unix timestamps use signed UTC
conversion.

## Verification

Tests cover levels, lazy filtering, flight changes, formatting, timestamps, isolated prefix contexts,
shared runtime state, custom output, capture generations, concurrency, and output failures.
