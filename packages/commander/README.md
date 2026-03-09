<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/commander@1.0.0/packages/commander#readme">@guanghechen/commander</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/commander">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/commander.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/commander">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/commander.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/commander">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/commander.svg"
      />
    </a>
    <a href="#install">
      <img
        alt="Module Formats: cjs"
        src="https://img.shields.io/badge/module_formats-cjs-green.svg"
      />
    </a>
    <a href="https://github.com/nodejs/node">
      <img
        alt="Node.js Version"
        src="https://img.shields.io/node/v/@guanghechen/commander"
      />
    </a>
    <a href="https://github.com/facebook/jest">
      <img
        alt="Tested with Jest"
        src="https://img.shields.io/badge/tested_with-jest-9c465e.svg"
      />
    </a>
    <a href="https://github.com/prettier/prettier">
      <img
        alt="Code Style: prettier"
        src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square"
      />
    </a>
  </div>
</header>
<br/>

A minimal, type-safe command-line interface builder with fluent API. Supports subcommands, option
parsing, shell completion generation (bash, fish, pwsh), and built-in help/version handling.

`opts` / `args` are designed for strong type inference from the current command's own declarations.

## Install

- npm

  ```bash
  npm install --save @guanghechen/commander
  ```

- yarn

  ```bash
  yarn add @guanghechen/commander
  ```

## Usage

### Basic Command

```typescript
import { Command } from '@guanghechen/commander/browser'

const cli = new Command({
  name: 'mycli',
  version: '1.0.0',
  desc: 'My awesome CLI tool',
})

cli
  .option({
    long: 'verbose',
    short: 'v',
    type: 'boolean',
    args: 'none',
    desc: 'Enable verbose output',
  })
  .option({
    long: 'output',
    short: 'o',
    type: 'string',
    args: 'required',
    desc: 'Output file path',
    default: './output.txt',
  })
  .argument({
    name: 'file',
    kind: 'required',
    desc: 'Input file to process',
  })
  .action(({ opts, args, ctx }) => {
    const file = String(args.file)
    ctx.reporter.info(`Processing ${file}...`)
    if (opts.verbose) {
      ctx.reporter.debug(`Output: ${opts.output}`)
    }
  })

cli.run({
  argv: process.argv.slice(2),
  envs: process.env,
})
```

### Subcommands

```typescript
import { Command } from '@guanghechen/commander/browser'

const root = new Command({
  name: 'git',
  version: '1.0.0',
  desc: 'A simple git-like CLI',
})

const clone = new Command({
  desc: 'Clone a repository',
})
  .argument({ name: 'url', kind: 'required', desc: 'Repository URL' })
  .option({ long: 'depth', type: 'number', args: 'required', desc: 'Shallow clone depth' })
  .action(({ args, opts }) => {
    console.log(`Cloning ${args.url} with depth ${opts.depth ?? 'full'}`)
  })

const commit = new Command({
  desc: 'Record changes to the repository',
})
  .option({ long: 'message', short: 'm', type: 'string', args: 'required', required: true, desc: 'Commit message' })
  .option({ long: 'amend', type: 'boolean', args: 'none', desc: 'Amend previous commit' })
  .action(({ opts }) => {
    console.log(`Committing: ${opts.message}`)
  })

root.subcommand('clone', clone).subcommand('commit', commit).subcommand('ci', commit)

root.run({ argv: process.argv.slice(2), envs: process.env })
```

### Shell Completion

```typescript
import { Command } from '@guanghechen/commander/browser'
import { CompletionCommand } from '@guanghechen/commander/node'

const root = new Command({
  name: 'mycli',
  version: '1.0.0',
  desc: 'My CLI with completion support',
})

// Add completion subcommand
root.subcommand('completion', new CompletionCommand(root))

// Generate completion scripts:
// mycli completion --bash > ~/.local/share/bash-completion/completions/mycli
// mycli completion --fish > ~/.config/fish/completions/mycli.fish
// mycli completion --pwsh >> $PROFILE
```

### Option Types

```typescript
import { Command } from '@guanghechen/commander/browser'

new Command({ name: 'example', desc: 'Option types demo' })
  // Boolean (flags)
  .option({ long: 'debug', type: 'boolean', args: 'none', desc: 'Enable debug mode' })

  // String with choices
  .option({
    long: 'format',
    type: 'string',
    args: 'required',
    choices: ['json', 'yaml', 'toml'],
    default: 'json',
    desc: 'Output format'
  })

  // Number
  .option({ long: 'port', type: 'number', args: 'required', default: 3000, desc: 'Server port' })

  // Array (generated by variadic args, not a standalone type)
  .option({ long: 'include', type: 'string', args: 'variadic', desc: 'Files to include' })

  // Required option
  .option({ long: 'config', type: 'string', args: 'required', required: true, desc: 'Config file' })

  // Custom coercion
  .option({
    long: 'date',
    type: 'string',
    args: 'required',
    coerce: (value) => new Date(value),
    desc: 'Date value',
  })
```

### Preset Profiles

Use `--preset-file` with an optional `--preset-profile=<profile[:variant]>` to load profile-based presets.

```bash
mycli run --preset-file=./preset.json --preset-profile=dev:staging
```

`preset.json` example:

```json
{
  "version": 1,
  "defaults": { "profile": "dev" },
  "profiles": {
    "dev": {
      "envFile": "dev.env",
      "envs": { "NODE_ENV": "development" },
      "opts": { "mode": "fast", "retry": 2 },
      "defaultVariant": "local",
      "variants": {
        "local": {
          "opts": { "retry": 1 }
        },
        "staging": {
          "envFile": "staging.env",
          "envs": { "NODE_ENV": "staging" },
          "opts": { "retry": 3 }
        }
      }
    }
  }
}
```

Schema:

```json
{
  "$schema": "./node_modules/@guanghechen/commander/lib/schema/preset.schema.json"
}
```

Behavior:

1. Profile selector resolution order is `--preset-profile` > `command.preset.profile` > `defaults.profile`.
2. Selector supports `<profile>` and `<profile>:<variant>`; when variant is omitted it falls back to `profile.defaultVariant`.
3. `envFile` is optional and resolved relative to the preset file directory when not absolute.
4. Variant fields override base profile fields by `base + variant`.
5. `opts` are converted into preset option fragments and merged before user CLI tokens.
6. `envs` override keys loaded from `envFile`.
7. Only `--preset-file` / `--preset-profile` are supported as preset directives.
8. `--preset-root` is removed.

### Built-in Coerce Factories

```typescript
import { Coerce, Command } from '@guanghechen/commander/browser'

new Command({ name: 'example', desc: 'Coerce demo' })
  .option({
    long: 'offset',
    type: 'number',
    args: 'required',
    coerce: Coerce.integer('--offset'),
    desc: 'Signed offset',
  })
  .option({
    long: 'parallel',
    type: 'number',
    args: 'required',
    coerce: Coerce.positiveInteger('--parallel'),
    desc: 'Parallel workers',
  })
  .option({
    long: 'duration',
    type: 'number',
    args: 'required',
    coerce: Coerce.positiveNumber('--duration'),
    desc: 'Duration in seconds',
  })
  .option({
    long: 'port',
    type: 'number',
    args: 'required',
    coerce: Coerce.port('--port'),
    desc: 'Server port',
  })
  .option({
    long: 'domain',
    type: 'string',
    args: 'required',
    coerce: Coerce.domain('--domain'),
    desc: 'Domain name',
  })
  .option({
    long: 'ip',
    type: 'string',
    args: 'required',
    coerce: Coerce.ip('--ip'),
    desc: 'IP address',
  })
  .option({
    long: 'host',
    type: 'string',
    args: 'required',
    coerce: Coerce.host('--host'),
    desc: 'Host (IP or domain)',
  })
  .option({
    long: 'mode',
    type: 'string',
    args: 'required',
    coerce: Coerce.choice('--mode', ['dev', 'test', 'prod'] as const),
    desc: 'Deploy mode',
  })
  .option({
    long: 'scale',
    type: 'number',
    args: 'required',
    coerce: Coerce.number('--scale'),
    desc: 'Scale factor',
  })
```

Default error message format:

```text
{name} is expected as {coerce type}, but got {raw}
```

You can still override the message via `Coerce.xxx(name, 'custom error message')`.

### Built-in Is Helpers

```typescript
import { isDomain, isIp, isIpv4, isIpv6 } from '@guanghechen/commander/browser'

isIpv4('127.0.0.1') // true
isIpv6('::1') // true
isIp('2001:db8::1') // true
isDomain('example.com') // true
```

### Help Examples

```typescript
import { Command } from '@guanghechen/commander/browser'

const cli = new Command({ name: 'mycli', desc: 'My CLI tool' })

cli
  .example('Initialize Project', 'init my-app', 'Create project scaffold')
  .example('Watch Build', 'build --watch', 'Rebuild on file changes')
  .action(() => {})

await cli.run({ argv: ['--help'], envs: process.env })
```

`usage` 是相对当前 command path 的片段，help 中会自动补齐前缀，例如 `mycli build --watch`。

`--color` / `--no-color` 仅控制 help 文本的终端着色； `--log-colorful` / `--no-log-colorful` 控制
`Reporter` 的日志着色。

当环境变量 `NO_COLOR` 存在时，help 渲染默认视为 `--no-color`；显式传入 `--color`
可以覆盖这个默认值。

`--devmode` 是内建 boolean 选项（默认 `false`）。仅当内建 `--log-level` 启用时：当其为
`true` 且未显式提供 `--log-level`，默认日志级别会提升为 `debug`。若显式传入
`--log-level`（包括 preset `opts` 注入），则显式值优先。

`devmode` 为保留 option 名，不允许通过 `.option({ long: 'devmode', ... })` 自定义。
在 `action` 中可通过 `params.builtin.devmode` 读取该内建选项的最终值（始终为 `boolean`）。

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/commander@1.0.0/packages/commander#readme
