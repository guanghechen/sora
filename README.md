# Sora Rust

Rust foundations for the Sora toolchain. The workspace targets Rust 1.96 or newer and currently
publishes three crates:

- [`guanghechen-chalk`](crates/chalk): deterministic ANSI terminal styling;
- [`guanghechen-commander`](crates/commander): deterministic command-line parsing, help, presets,
  and shell completion;
- [`guanghechen-reporter`](crates/reporter): thread-safe, level-based reporting.

`commander` and `reporter` depend on `chalk`; the core crates have no other runtime dependencies.

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

All crates currently share one workspace version. Publish `guanghechen-chalk` first, wait until its
new version is available from the crates.io index, then publish `guanghechen-reporter` and
`guanghechen-commander`.

## License

[MIT](LICENSE)
