<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/byte@2.0.0/packages/byte#readme">@guanghechen/byte</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/byte">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/byte.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/byte">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/byte.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/byte">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/byte.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/byte"
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

Utility functions for bytes (Uint8Array). Provides encoding/decoding between bytes and various text
formats (base64, hex, utf8), along with common byte manipulation utilities.

## Install

- npm

  ```bash
  npm install --save @guanghechen/byte
  ```

- yarn

  ```bash
  yarn add @guanghechen/byte
  ```

## Usage

### Encoding / Decoding

```typescript
import {
  text2bytes,
  bytes2text,
  base64Text2bytes,
  bytes2base64Text,
  hexText2bytes,
  bytes2hexText,
  utf8Text2bytes,
  bytes2utf8Text,
} from '@guanghechen/byte'

// Generic encoding/decoding with encoding type
const bytes = text2bytes('Hello World', 'utf8')
const text = bytes2text(bytes, 'utf8') // 'Hello World'

// Base64
const base64Bytes = base64Text2bytes('SGVsbG8gV29ybGQ=')
const base64Text = bytes2base64Text(new Uint8Array([72, 101, 108, 108, 111])) // 'SGVsbG8='

// Hex
const hexBytes = hexText2bytes('48656c6c6f')
const hexText = bytes2hexText(new Uint8Array([72, 101, 108, 108, 111])) // '48656c6c6f'

// UTF-8
const utf8Bytes = utf8Text2bytes('Hello')
const utf8Text = bytes2utf8Text(utf8Bytes) // 'Hello'
```

### Byte Manipulation

```typescript
import {
  mergeBytes,
  areSameBytes,
  randomBytes,
  destroyBytes,
} from '@guanghechen/byte'

// Merge multiple Uint8Arrays into one
const merged = mergeBytes([
  new Uint8Array([1, 2]),
  new Uint8Array([3, 4]),
]) // Uint8Array [1, 2, 3, 4]

// Compare two Uint8Arrays
const isEqual = areSameBytes(
  new Uint8Array([1, 2, 3]),
  new Uint8Array([1, 2, 3]),
) // true

// Generate cryptographically random bytes
const random = randomBytes(16) // 16 random bytes

// Securely destroy sensitive byte data
const sensitiveData = new Uint8Array([1, 2, 3, 4])
destroyBytes(sensitiveData) // Overwrites with zeros, ones, then random values
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/byte@2.0.0/packages/byte#readme
