# Sora Rust

Rust foundations for the Sora toolchain. The workspace targets Rust 1.96 or newer and contains five
publishable crates:

- [`guanghechen-chalk`](crates/chalk): deterministic ANSI terminal styling;
- [`guanghechen-cli-reporter`](crates/cli-reporter): buffered one-shot CLI reporting composition;
- [`guanghechen-commander`](crates/commander): deterministic command-line parsing, help, presets,
  and shell completion;
- [`guanghechen-env`](crates/env): deterministic `.env` parsing and recursive resolution;
- [`guanghechen-reporter`](crates/reporter): thread-safe, level-based reporting.

`env` has no runtime dependencies. `reporter` depends on `chalk`, `commander` depends on both
`chalk` and `env`, and `cli-reporter` composes `commander` with `reporter` without introducing a
dependency between those peer foundations.

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
`guanghechen-env` before their dependents, and wait until each dependency version is available from
the crates.io index. Publish `guanghechen-cli-reporter` only after both `guanghechen-commander` and
`guanghechen-reporter` are indexed.

## License

[MIT](LICENSE)
