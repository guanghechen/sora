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

## License

[MIT](https://github.com/guanghechen/sora/blob/rust/LICENSE)
