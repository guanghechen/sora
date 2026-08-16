# Changelog

All notable changes to the Rust crates in this repository are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the crates use
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `guanghechen-chalk`: add explicit file path presentation with visible control sanitization,
  optional underlined cyan styling, absolute `file:` URI encoding, and OSC 8 hyperlinks.
- `guanghechen-cli-reporter`: add the Commander-aware buffered adapter for one-shot Reporter
  lifecycle, effective terminal/color policy, normalized terminal errors, and explicit suppression.

### Security

- `guanghechen-reporter`: expose its console-message escaping primitive so terminal-facing custom
  sinks can share the default sink's one-line control-sanitization contract.
- `guanghechen-cli-reporter`: visibly escape untrusted message controls before buffered terminal
  output instead of forwarding raw custom-sink messages.

## [0.1.2] - 2026-08-09

### Security

- `guanghechen-env`: add explicit source and expanded-value limits for untrusted parsing and
  resolution, avoid dependency-edge key duplication, and reject unsafe control characters during
  stringification unless callers explicitly select the legacy preservation policy.
- `guanghechen-reporter`: visibly escape untrusted message controls in the default console sink and
  reject control characters in prefixes while preserving raw messages for custom sinks and capture.
- `guanghechen-commander`: bound preset environment expansion, visibly escape untrusted diagnostic
  text, and redact runtime values from container and error `Debug` output.

### Changed

- Document that environment search roots are discovery boundaries rather than symlink containment
  boundaries, and that Commander presets and referenced environment files are trusted
  configuration.
- Publish all foundation crates at one synchronized patch version so exact internal dependency pins
  keep a single compatible graph for downstream consumers.

## [0.1.1] - 2026-08-08

### Changed

- `guanghechen-commander`: delegate preset environment parsing to `guanghechen-env`, adding
  multiline quoted values and the shared key grammar while keeping declaration-order interpolation,
  caller-owned environment acquisition, and value-redacted errors.
- Publish all foundation crates at one synchronized version so exact internal dependency pins keep a
  single compatible graph for downstream consumers.

## [0.1.0] - 2026-08-07

### Added

- `guanghechen-chalk`: deterministic ANSI styling with explicit color capability, nested style
  restoration, and ANSI16/ANSI256/true-color rendering.
- `guanghechen-commander`: validated command trees, strict parsing, structured diagnostics, preset
  resolution, help data, and Bash/Fish/PowerShell completion.
- `guanghechen-env`: deterministic `.env` parsing and stringification, recursive reference
  resolution, prioritized upward file discovery, and value-redacted errors.
- `guanghechen-reporter`: thread-safe level filtering, prefix contexts, configurable formatting,
  output injection, and isolated capture sessions.
