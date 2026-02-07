<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/string@2.0.0/packages/string#readme">@guanghechen/string</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/string">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/string.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/string">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/string.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/string">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/string.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/string"
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

String utilities including case transformers, bytes parsers, and number/interval collectors.

## Install

- npm

  ```bash
  npm install --save @guanghechen/string
  ```

- yarn

  ```bash
  yarn add @guanghechen/string
  ```

## Usage

### Case Transformers

```typescript
import {
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toPascalCase,
  toConstantCase,
  toCapitalCase,
  toSentenceCase,
  toTitleCase,
  toDotCase,
  toPathCase,
  composeTextTransformers,
  toTrim,
} from '@guanghechen/string'

toCamelCase('test string')     // 'testString'
toKebabCase('test string')     // 'test-string'
toSnakeCase('test string')     // 'test_string'
toPascalCase('test string')    // 'TestString'
toConstantCase('test string')  // 'TEST_STRING'
toCapitalCase('test string')   // 'Test String'
toSentenceCase('testString')   // 'Test string'
toTitleCase('a simple test')   // 'A Simple Test'
toDotCase('test string')       // 'test.string'
toPathCase('test string')      // 'test/string'

// Compose multiple transformers
const transform = composeTextTransformers(toTrim, toKebabCase)
transform(' TeSt_StrinG ')     // 'test-string'
```

### Bytes Parser

```typescript
import { parseBytesString } from '@guanghechen/string'

parseBytesString('1K')    // 1024
parseBytesString('1KB')   // 1024
parseBytesString('1M')    // 1048576
parseBytesString('1MB')   // 1048576
parseBytesString('1.5G')  // 1610612736
parseBytesString('100')   // 100
parseBytesString('2T')    // 2199023255552
```

### Number/Interval Collectors

Parse comma/space-separated number ranges:

```typescript
import { collectNumbers, collectIntervals } from '@guanghechen/string'

// Collect individual numbers from ranges
collectNumbers('1-3')           // [1, 2, 3]
collectNumbers('3,1-2,2,2')     // [1, 2, 3]
collectNumbers('2-4,1-3,5-9')   // [1, 2, 3, 4, 5, 6, 7, 8, 9]

// Collect merged intervals
collectIntervals('1-3')         // [[1, 3]]
collectIntervals('3,7-5,2,2')   // [[2, 3], [5, 7]]
collectIntervals('2-4,1-3,6-9') // [[1, 4], [6, 9]]

// Custom separator
collectNumbers('1;2;3-5', /;/)  // [1, 2, 3, 4, 5]
```

### Transformer Reference

| Transformer       | Input           | Output          |
| :---------------: | :-------------: | :-------------: |
| `toCamelCase`     | 'test string'   | 'testString'    |
| `toCapitalCase`   | 'test string'   | 'Test String'   |
| `toConstantCase`  | 'test string'   | 'TEST_STRING'   |
| `toDotCase`       | 'test string'   | 'test.string'   |
| `toKebabCase`     | 'test string'   | 'test-string'   |
| `toLowerCase`     | 'TEST STRING'   | 'test string'   |
| `toPascalCase`    | 'test string'   | 'TestString'    |
| `toPathCase`      | 'test string'   | 'test/string'   |
| `toSentenceCase`  | 'testString'    | 'Test string'   |
| `toSnakeCase`     | 'test string'   | 'test_string'   |
| `toTitleCase`     | 'a simple test' | 'A Simple Test' |
| `toUpperCase`     | 'test string'   | 'TEST STRING'   |
| `toTrim`          | ' test '        | 'test'          |

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/string@2.0.0/packages/string#readme
