<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/file-split@2.0.0/packages/file-split#readme">@guanghechen/file-split</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/file-split">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/file-split.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/file-split">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/file-split.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/file-split">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/file-split.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/file-split"
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

A collection of utility functions for handling files, such as split big file or merge multiple small
files.

## Install

- npm

  ```bash
  npm install --save @guanghechen/file-split
  ```

- yarn

  ```bash
  yarn add @guanghechen/file-split
  ```

## Usage

- `FileSplitter` (inspired by [file-split][])

  ```typescript
  import { FileSplitter } from '@guanghechen/file-split'
  import { calcFilePartItemsBySize } from '@guanghechen/filepart'

  async function splitFile(filepath: string): Promise<string[]> {
    const splitter = new FileSplitter()
    const parts = calcFilePartItemsBySize(filepath, 1024 * 1024 * 80) // 80MB per chunk
    const partFilepaths: string[] = await splitter.split(filepath, parts)
    return partFilepaths
  }

  splitFile('big-file.txt')
  ```

### Overview

|       Name       |                  Description                  |
| :--------------: | :-------------------------------------------: |
|  `FileSplitter`  | A utility class for splitting / merging files |

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/file-split@2.0.0/packages/file-split#readme
[file-split]: https://github.com/tomvlk/node-file-split
