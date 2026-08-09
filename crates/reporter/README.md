# guanghechen-reporter

A thread-safe, level-based reporting foundation with shared runtime configuration, isolated prefix
contexts, configurable formatting, output injection, and capture sessions for tests.

```rust
use guanghechen_reporter::{LogLevel, Reporter};

let reporter = Reporter::new();
reporter.set_level(LogLevel::Info);
reporter.info("ready").unwrap();
```

The default console output renders each record on one physical line and visibly escapes control
characters supplied in messages. Custom outputs and test capture receive the original message.
Prefix components reject `:` and control characters.

## License

[MIT](https://github.com/guanghechen/sora/blob/rust/LICENSE)
