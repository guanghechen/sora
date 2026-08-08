# Sora Rust

Rust foundations for the Sora toolchain. The workspace targets Rust 1.96 or newer and currently
publishes four crates:

- [`guanghechen-chalk`](crates/chalk): deterministic ANSI terminal styling;
- [`guanghechen-commander`](crates/commander): deterministic command-line parsing, help, presets,
  and shell completion;
- [`guanghechen-env`](crates/env): deterministic `.env` parsing and recursive resolution;
- [`guanghechen-reporter`](crates/reporter): thread-safe, level-based reporting.

`commander` and `reporter` depend on `chalk`; `env` has no runtime dependencies.

## Development

Run the full local verification suite:

```sh
make check
```

Inspect the exact crate contents before publishing:

```sh
make prepublish
```

## Release order

All crates currently share one workspace version. `guanghechen-env` can be published independently.
Publish `guanghechen-chalk` before `guanghechen-reporter` and `guanghechen-commander`, and wait until
the new `chalk` version is available from the crates.io index before publishing its dependents.

## License

[MIT](LICENSE)
