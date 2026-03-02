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

### Preset Input Files

`--preset-opts=<file>` and `--preset-envs=<file>` allow injecting preset argv and
env inputs before normal CLI parsing.

```bash
mycli --preset-opts=./options.argv --preset-envs=./preset.env --log-level debug --color
```

Behavior:

1. Route command chain from user argv (name/alias only, no argv rewrite), then store route tokens in `sources.user.cmds`.
2. Run `control-scan` on user tail argv before preset merge: detect `--help` / `--version` by token scan (`--version` only when `supportsBuiltinVersion(leaf)`), detect `help` only when it is the first tail token, write `ctx.controls`, and strip control tokens from parse input.
3. In `run()`, execute `run-control` before preset merge: short-circuit by `help > version`. If short-circuit hits, preset files are not loaded.
4. Scan preset directives before `--`, remove them from control-tail argv, and store cleaned tokens in `sources.user.argv`.
5. Read options preset file(s) and tokenize by whitespace to `sources.preset.argv`.
6. Read env preset file(s) and parse via `@guanghechen/env.parse` to `sources.preset.envs`.
7. Build `effectiveTailArgv = [...sources.preset.argv, ...sources.user.argv]`.
8. Build `ctx.envs = { ...sources.user.envs, ...sources.preset.envs }`.
9. Expose source snapshots through `ctx.sources` and reuse existing tokenize/resolve/parse pipeline.

Precedence for same option key:

1. User CLI tokens (highest)
2. Tokens loaded from `--preset-opts`
3. Option `default` / implicit defaults
4. `NO_COLOR` fallback for color rendering only (applies only when no explicit `--color/--no-color` token appears)

Precedence for same env key:

1. Key-values loaded from `--preset-envs` (highest)
2. User envs (e.g. `process.env`)

Additional notes:

1. `variadic` options append in appearance order.
2. `NO_COLOR` is evaluated from `ctx.envs` and remains a fallback only when no color token is explicitly provided.
3. The `--preset-opts` file is expected to contain option fragments (`-x`/`--xxx` and their values), not command-route tokens.
4. The `--preset-envs` file must be parseable by `@guanghechen/env`.
5. Only preset flags before `--` are processed; after `--` they are treated as normal args.
6. Repeated preset flags are processed in appearance order.
7. Built-in control semantics recognize `--help` / `help` / `--version` only (no short aliases).
8. `long: 'help'` and `long: 'version'` are reserved and must not be user-defined in `.option()`.
9. `--help` / `help` / `--version` are forbidden in `--preset-opts` files; loading should fail fast.
10. `--` is forbidden inside `--preset-opts` files; loading should fail fast.
11. `parse()` never executes control handlers; it only records control hits in `ctx.controls`.

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

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/commander@1.0.0/packages/commander#readme
