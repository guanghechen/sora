<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/resource@2.0.0/packages/resource#readme">@guanghechen/resource</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/resource">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/resource.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/resource">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/resource.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/resource">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/resource.svg"
      />
    </a>
    <a href="#install">
      <img
        alt="Module Formats: cjs, esm"
        src="https://img.shields.io/badge/module_formats-cjs%2C%20esm-green.svg"
      />
    </a>
    <a href="https://github.com/nodejs/node">
      <img
        alt="Node.js Version"
        src="https://img.shields.io/node/v/@guanghechen/resource"
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

Text resource abstraction with file-based and memory-based implementations. Implements the
`ITextResource` interface for unified resource management with load, save, and destroy operations.

## Install

- npm

  ```bash
  npm install --save @guanghechen/resource
  ```

- yarn

  ```bash
  yarn add @guanghechen/resource
  ```

## Usage

### FileTextResource

File-based text resource:

```typescript
import { FileTextResource } from '@guanghechen/resource'

const resource = new FileTextResource({
  filepath: '/path/to/config.json',
  encoding: 'utf8',
  strict: false, // If true, throws when file doesn't exist on load
})

// Check existence
const exists = await resource.exists() // true/false

// Load content
const content = await resource.load()
if (content) {
  console.log('Loaded:', content)
}

// Save content (creates parent directories if needed)
await resource.save('{"key": "value"}')

// Delete file
await resource.destroy()
```

### MemoTextResource

In-memory text resource (useful for testing):

```typescript
import { MemoTextResource } from '@guanghechen/resource'

const resource = new MemoTextResource({
  content: 'initial content',
  encoding: 'utf8',
  strict: false, // If true, throws on load/save after destroy
})

// Load content
const content = await resource.load() // 'initial content'

// Save new content
await resource.save('updated content')

// Check if resource is alive
const exists = await resource.exists() // true

// Destroy (marks as not alive)
await resource.destroy()
await resource.exists() // false
```

### Strict Mode

Both resources support strict mode for error handling:

```typescript
import { FileTextResource, MemoTextResource } from '@guanghechen/resource'

// Strict file resource - throws if file doesn't exist
const strictFile = new FileTextResource({
  filepath: '/nonexistent/file.txt',
  encoding: 'utf8',
  strict: true,
})
await strictFile.load() // throws Error

// Strict memo resource - throws after destroy
const strictMemo = new MemoTextResource({
  content: 'data',
  encoding: 'utf8',
  strict: true,
})
await strictMemo.destroy()
await strictMemo.load() // throws Error
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/resource@2.0.0/packages/resource#readme
