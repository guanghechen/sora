# guanghechen-cli-reporter

A Commander-aware, buffered reporting adapter for one-shot CLIs. It maps resolved Commander
logging controls onto `guanghechen-reporter`, exposes effective terminal/color state to semantic
renderers, visibly escapes message controls for terminal-facing output, and owns final error-record
and flush behavior.

```rust
use guanghechen_cli_reporter::run_reported;
use guanghechen_commander::{Command, ParseOutcome};

let command = Command::builder("demo", "Demo command").build().unwrap();
let ParseOutcome::Matches(matches) = command.parse_from([] as [&str; 0]).unwrap() else {
    unreachable!();
};
let mut stderr = Vec::new();
let code = run_reported(
    &matches,
    "demo",
    &mut stderr,
    false,
    |reporter| reporter.info("ready"),
    |_| 1,
);
assert_eq!(code, 0);
```

The crate does not inspect TTYs, process environment, arguments, or global stdio. Callers own those
boundaries and provide the combined terminal state of every possible reporter destination.

## License

[MIT](https://github.com/guanghechen/sora/blob/rust/LICENSE)
