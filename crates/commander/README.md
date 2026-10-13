# guanghechen-commander

A deterministic command-line interface foundation with validated command trees, strict parsing,
structured diagnostics, presets, help metadata, and shell completion.

The crate owns parsing and metadata, while callers retain control of actions, process exit, streams,
environment mutation, and other side effects.

```rust
use guanghechen_commander::{Command, OptionSpec, ParseOutcome, Value};

let command = Command::builder("tool", "Example tool")
    .option(OptionSpec::flag("verbose", "Verbose output").short('v'))
    .build()
    .unwrap();

let ParseOutcome::Matches(matches) = command.parse_from(["--verbose"]).unwrap() else {
    panic!("expected parsed matches");
};
assert_eq!(matches.option("verbose"), Some(&Value::Bool(true)));
```

Diagnostic messages visibly escape control and non-printable Unicode characters supplied through
argv, presets, paths, or custom coercers. Structured inputs and parsed values retain their original
data.

Container `Debug` implementations redact environment, argv, option, argument, preset, and completion
query values by default. Existing accessors return the original data, and explicitly formatting an
accessed `Value` reveals that value.

Preset manifests and their referenced environment files are trusted configuration, not sandboxed
documents. Absolute paths, parent traversal, and symlinks are followed; callers must not select a
preset from an untrusted filesystem tree.

## Shell completion

Completion scripts query the CLI at completion time. Generated Fish scripts require Fish 3.0 or
later because they use `read --delimiter` and `string split0`.

After upgrading a CLI to Commander 0.2.0, regenerate its installed completion scripts to enable the
updated shell adapters. Fish 2.x users must keep their previously generated scripts or upgrade Fish
before regenerating them. Existing scripts remain compatible with the candidate query protocol,
and the Rust completion APIs retain their owned return values.

The Fish adapter buffers each query's output before processing it. Batches of simple candidate
tokens are forwarded directly; other batches use Fish's escaping. This reduces shell overhead for
ordinary options and command names, while buffered output uses additional memory and can add
overhead for batches that require escaping.

## License

[MIT](https://github.com/guanghechen/sora/blob/rust/LICENSE)
