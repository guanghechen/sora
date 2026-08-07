# Repository Guidelines

## Pre-commit Safety Checks

Before every commit:

- Check the repository and staged changes for real, machine-specific absolute paths, such as
  `/Users/<name>/...`, `/home/<name>/...`, `C:\\Users\\<name>\\...`, or UNC paths. Do not commit
  them. Clearly synthetic paths used only in tests are allowed.
- Check the repository and staged changes for sensitive data, including credentials, API keys,
  tokens, passwords, private keys, and secret-bearing configuration files. Do not commit real
  sensitive values; use explicit placeholders in examples and fixtures.

## Release Tags

- Tag every published Rust crate separately.
- Format each tag as `<crate-name>@v<crate-version>`, for example
  `guanghechen-chalk@v0.1.0`.
- Point each tag to the exact commit used to publish that crate.
