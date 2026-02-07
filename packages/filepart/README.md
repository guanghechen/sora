<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/filepart@2.0.0/packages/filepart#readme">@guanghechen/filepart</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/filepart">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/filepart.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/filepart">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/filepart.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/filepart">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/filepart.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/filepart"
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

File helper utilities for calculating file part ranges and generating part names. Useful for
splitting large files into smaller chunks.

## Install

- npm

  ```bash
  npm install --save @guanghechen/filepart
  ```

- yarn

  ```bash
  yarn add @guanghechen/filepart
  ```

## Usage

### Calculate File Parts by Size

Split a file into parts of a specific size:

```typescript
import { calcFilePartItemsBySize } from '@guanghechen/filepart'

const fileSize = 1000 // bytes
const partSize = 300  // bytes per part

const parts = [...calcFilePartItemsBySize(fileSize, partSize)]
// Result:
// [
//   { sid: 1, start: 0, end: 300 },
//   { sid: 2, start: 300, end: 600 },
//   { sid: 3, start: 600, end: 900 },
//   { sid: 4, start: 900, end: 1000 }
// ]
```

### Calculate File Parts by Count

Split a file into a specific number of parts:

```typescript
import { calcFilePartItemsByCount } from '@guanghechen/filepart'

const fileSize = 1000 // bytes
const partCount = 3   // number of parts

const parts = [...calcFilePartItemsByCount(fileSize, partCount)]
// Result:
// [
//   { sid: 1, start: 0, end: 334 },
//   { sid: 2, start: 334, end: 668 },
//   { sid: 3, start: 668, end: 1000 }
// ]
```

### Generate Part Names

Generate file part names with padded sequence numbers:

```typescript
import { calcFilePartNames, calcFilePartNamesByCount } from '@guanghechen/filepart'

// From existing parts
const parts = [{ sid: 1 }, { sid: 2 }, { sid: 3 }]
const names = [...calcFilePartNames(parts, '.part')]
// Result: ['.part1', '.part2', '.part3']

// For 14 parts (with zero-padding)
const names14 = [...calcFilePartNamesByCount(14, '.part')]
// Result: ['.part01', '.part02', ... '.part14']

// Single part returns empty string (no suffix needed)
const singlePart = [...calcFilePartNamesByCount(1, '.part')]
// Result: ['']
```

### Constants

```typescript
import { DEFAULT_FILEPART_CODE_PREFIX } from '@guanghechen/filepart'

console.log(DEFAULT_FILEPART_CODE_PREFIX) // '.ghc-part'
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/filepart@2.0.0/packages/filepart#readme
