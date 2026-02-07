<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/filesplit@2.0.0/packages/filesplit#readme">@guanghechen/filesplit</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/filesplit">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/filesplit.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/filesplit">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/filesplit.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/filesplit">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/filesplit.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/filesplit"
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

A utility class for splitting large files into smaller chunks and merging them back. Inspired by
[node-split-file](https://github.com/tomvlk/node-split-file).

## Install

- npm

  ```bash
  npm install --save @guanghechen/filesplit
  ```

- yarn

  ```bash
  yarn add @guanghechen/filesplit
  ```

## Usage

### Split a File

```typescript
import { FileSplitter } from '@guanghechen/filesplit'
import { calcFilePartItemsBySize } from '@guanghechen/filepart'
import fs from 'node:fs'

async function splitFile(filepath: string): Promise<string[]> {
  const splitter = new FileSplitter()
  const fileSize = fs.statSync(filepath).size
  const parts = [...calcFilePartItemsBySize(fileSize, 1024 * 1024 * 80)] // 80MB per chunk
  const partFilepaths: string[] = await splitter.split(filepath, parts)
  return partFilepaths
}

// Split 'large-file.zip' into 80MB chunks
// Result: ['large-file.zip.ghc-part01', 'large-file.zip.ghc-part02', ...]
await splitFile('large-file.zip')
```

### Merge Files

```typescript
import { FileSplitter } from '@guanghechen/filesplit'

const splitter = new FileSplitter()

// Merge chunks back into original file
await splitter.merge(
  ['large-file.zip.ghc-part01', 'large-file.zip.ghc-part02', 'large-file.zip.ghc-part03'],
  'large-file-restored.zip'
)
```

### Custom Part Code Prefix

```typescript
import { FileSplitter } from '@guanghechen/filesplit'

// Use custom suffix for part files
const splitter = new FileSplitter({ partCodePrefix: '.chunk' })

// Split will create: file.txt.chunk01, file.txt.chunk02, etc.
```

### Using Default Instance

```typescript
import { fileSplitter } from '@guanghechen/filesplit'

// Use the default singleton instance
await fileSplitter.split(filepath, parts)
await fileSplitter.merge(inputFilepaths, outputFilepath)
```

### Calculate Part Filepaths

```typescript
import { FileSplitter } from '@guanghechen/filesplit'
import { calcFilePartItemsByCount } from '@guanghechen/filepart'

const splitter = new FileSplitter()
const parts = [...calcFilePartItemsByCount(1000000, 3)]

// Get the expected part filepaths without actually splitting
const partFilepaths = splitter.calcPartFilepaths('/path/to/file.zip', parts)
// Result: ['/path/to/file.zip.ghc-part1', '/path/to/file.zip.ghc-part2', '/path/to/file.zip.ghc-part3']
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/filesplit@2.0.0/packages/filesplit#readme
