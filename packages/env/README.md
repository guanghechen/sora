<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/env@1.0.0/packages/env#readme">@guanghechen/env</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/env">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/env.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/env">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/env.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/env">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/env.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/env"
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

A minimal .env parser with typed value support and variable interpolation. Supports comments,
`export` prefix, quoted values (single/double), escape sequences, and `${VAR}` interpolation.

## Install

- npm

  ```bash
  npm install --save @guanghechen/env
  ```

- yarn

  ```bash
  yarn add @guanghechen/env
  ```

## Usage

### Parsing .env Content

```typescript
import { parse } from '@guanghechen/env'

const content = `
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp

# With export prefix
export API_KEY=secret123

# Quoted values
MESSAGE="Hello, World!"
SINGLE_QUOTED='No interpolation here'

# Variable interpolation (double quotes or unquoted)
DB_URL="postgres://\${DB_HOST}:\${DB_PORT}/\${DB_NAME}"

# Escape sequences in double quotes
MULTILINE="Line1\\nLine2\\nLine3"
`

const env = parse(content)
console.log(env.DB_HOST)   // 'localhost'
console.log(env.DB_PORT)   // '5432'
console.log(env.DB_URL)    // 'postgres://localhost:5432/myapp'
console.log(env.MULTILINE) // 'Line1\nLine2\nLine3'
```

### Stringifying to .env Format

```typescript
import { stringify } from '@guanghechen/env'

const env = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  MESSAGE: 'Hello World',
  SECRET: 'my-secret-key',
}

// Basic stringify
const content = stringify(env)
// DB_HOST=localhost
// DB_PORT=5432
// MESSAGE="Hello World"
// SECRET=my-secret-key

// With exclusion
const filtered = stringify(env, { exclude: ['SECRET'] })
// DB_HOST=localhost
// DB_PORT=5432
// MESSAGE="Hello World"
```

### Supported Syntax

```bash
# Comments start with #
KEY=value

# Optional export prefix
export KEY=value

# Double-quoted values (with escape sequences and interpolation)
KEY="value with spaces"
KEY="Line1\nLine2"
KEY="Uses ${OTHER_VAR}"

# Single-quoted values (literal, no processing)
KEY='${NOT_INTERPOLATED}'

# Inline comments (unquoted values only)
KEY=value # this is a comment

# Empty values
KEY=
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/env@1.0.0/packages/env#readme
