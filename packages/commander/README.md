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
import { Command } from '@guanghechen/commander'

const cli = new Command({
  name: 'mycli',
  version: '1.0.0',
  description: 'My awesome CLI tool',
})

cli
  .option({
    long: 'verbose',
    short: 'v',
    type: 'boolean',
    description: 'Enable verbose output',
  })
  .option({
    long: 'output',
    short: 'o',
    type: 'string',
    description: 'Output file path',
    default: './output.txt',
  })
  .argument({
    name: 'file',
    kind: 'required',
    description: 'Input file to process',
  })
  .action(({ opts, args, ctx }) => {
    const [file] = args
    ctx.reporter.info(`Processing ${file}...`)
    if (opts['verbose']) {
      ctx.reporter.debug(`Output: ${opts['output']}`)
    }
  })

cli.run({
  argv: process.argv.slice(2),
  envs: process.env,
})
```

### Subcommands

```typescript
import { Command } from '@guanghechen/commander'

const root = new Command({
  name: 'git',
  version: '1.0.0',
  description: 'A simple git-like CLI',
})

const clone = new Command({
  description: 'Clone a repository',
})
  .argument({ name: 'url', kind: 'required', description: 'Repository URL' })
  .option({ long: 'depth', type: 'number', description: 'Shallow clone depth' })
  .action(({ args, opts }) => {
    console.log(`Cloning ${args[0]} with depth ${opts['depth'] ?? 'full'}`)
  })

const commit = new Command({
  description: 'Record changes to the repository',
})
  .option({ long: 'message', short: 'm', type: 'string', required: true, description: 'Commit message' })
  .option({ long: 'amend', type: 'boolean', description: 'Amend previous commit' })
  .action(({ opts }) => {
    console.log(`Committing: ${opts['message']}`)
  })

root.subcommand('clone', clone).subcommand('commit', commit).subcommand('ci', commit)

root.run({ argv: process.argv.slice(2), envs: process.env })
```

### Shell Completion

```typescript
import { Command, CompletionCommand } from '@guanghechen/commander'

const root = new Command({
  name: 'mycli',
  version: '1.0.0',
  description: 'My CLI with completion support',
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
import { Command } from '@guanghechen/commander'

new Command({ name: 'example', description: 'Option types demo' })
  // Boolean (flags)
  .option({ long: 'debug', type: 'boolean', description: 'Enable debug mode' })

  // String with choices
  .option({
    long: 'format',
    type: 'string',
    choices: ['json', 'yaml', 'toml'],
    default: 'json',
    description: 'Output format'
  })

  // Number
  .option({ long: 'port', type: 'number', default: 3000, description: 'Server port' })

  // Array (can be specified multiple times)
  .option({ long: 'include', type: 'string[]', description: 'Files to include' })

  // Required option
  .option({ long: 'config', type: 'string', required: true, description: 'Config file' })

  // Custom coercion
  .option({
    long: 'date',
    type: 'string',
    coerce: (value) => new Date(value),
    description: 'Date value',
  })
```

### Built-in Coerce Factories

```typescript
import { Coerce, Command } from '@guanghechen/commander'

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

### Help Examples

```typescript
import { Command } from '@guanghechen/commander'

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
