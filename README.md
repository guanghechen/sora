# Sora Rust

Rust foundations for the Sora toolchain. The workspace targets Rust 1.96 or newer and currently
publishes four crates:

- [`guanghechen-chalk`](crates/chalk): deterministic ANSI terminal styling;
- [`guanghechen-commander`](crates/commander): deterministic command-line parsing, help, presets,
  and shell completion;
- [`guanghechen-env`](crates/env): deterministic `.env` parsing and recursive resolution;
- [`guanghechen-reporter`](crates/reporter): thread-safe, level-based reporting.

`env` has no runtime dependencies. `reporter` depends on `chalk`, while `commander` depends on both
`chalk` and `env`.

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

All crates currently share one workspace version. Publish `guanghechen-chalk` and
`guanghechen-env` before their dependents, and wait until the new versions are available from the
crates.io index before publishing `guanghechen-reporter` or `guanghechen-commander`.

## License

[MIT](LICENSE)
