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
  name: 'clone',
  description: 'Clone a repository',
})
  .argument({ name: 'url', kind: 'required', description: 'Repository URL' })
  .option({ long: 'depth', type: 'number', description: 'Shallow clone depth' })
  .action(({ args, opts }) => {
    console.log(`Cloning ${args[0]} with depth ${opts['depth'] ?? 'full'}`)
  })

const commit = new Command({
  name: 'commit',
  aliases: ['ci'],
  description: 'Record changes to the repository',
})
  .option({ long: 'message', short: 'm', type: 'string', required: true, description: 'Commit message' })
  .option({ long: 'amend', type: 'boolean', description: 'Amend previous commit' })
  .action(({ opts }) => {
    console.log(`Committing: ${opts['message']}`)
  })

root.subcommand(clone).subcommand(commit)

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
root.subcommand(new CompletionCommand(root))

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

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/commander@1.0.0/packages/commander#readme
