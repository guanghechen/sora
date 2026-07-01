<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/release-2.x.x/packages/githooks#readme">@guanghechen/githooks</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/githooks">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/githooks.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/githooks">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/githooks.svg"
      />
    </a>
    <a href="#install">
      <img
        alt="Module Formats: esm"
        src="https://img.shields.io/badge/module_formats-esm-green.svg"
      />
    </a>
  </div>
</header>
<br/>

A tiny, zero-dependency git hooks installer. It generates hook scripts from a `githooks` field in
your `package.json` into a `.githooks/` directory and points git at them via `core.hooksPath`.
Designed to replace the `husky` + `is-ci` + `pinst` trio for simple setups.

> **ESM-only.** This package ships ES modules only. CommonJS callers should use dynamic `import()`,
> or Node.js `>= 20.19` (which supports `require()` of ES modules). The `githooks` CLI is unaffected.

## Install

```bash
npm install --save-dev @guanghechen/githooks
```

## Usage

### Configure

Declare the hooks you want in `package.json`:

```json
{
  "githooks": {
    "hooks": {
      "pre-commit": "pnpm exec lint-staged"
    }
  },
  "scripts": {
    "postinstall": "githooks install"
  }
}
```

### CLI

```bash
githooks install     # generate .githooks/ and set core.hooksPath (default command)
githooks uninstall   # remove .githooks/ and unset core.hooksPath
githooks list        # print configured hooks and current core.hooksPath
```

Behavior:

- `install` is a no-op in CI (any truthy `CI` env var) or outside a git work tree — this replaces
  the role of `is-ci`.
- Because installation is driven by your own repo's `postinstall` (not by this package), there is no
  lifecycle script shipped to downstream consumers — this removes the need for `pinst`.
- Set `GITHOOKS=0` when running git to bypass a hook once (e.g. `GITHOOKS=0 git commit ...`).

### Programmatic API

```typescript
import { installHooks, uninstallHooks, listHooks } from '@guanghechen/githooks'

installHooks({ cwd: process.cwd() })
```

## API

```typescript
function installHooks(options?: IGithooksOptions): boolean
function uninstallHooks(options?: IGithooksOptions): boolean
function listHooks(options?: IGithooksOptions): Record<string, string>

interface IGithooksOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  logger?: { info(message: string): void }
}
```

## Reference

- [homepage][homepage]

[homepage]: https://github.com/guanghechen/sora/tree/release-2.x.x/packages/githooks#readme
