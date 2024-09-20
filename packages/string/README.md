<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/string@1.0.1/packages/string#readme">@guanghechen/string</a>
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

Utilities for processing strings or stringify other type data.

## Install

* npm

  ```bash
  npm install --save-dev @guanghechen/string
  ```

* yarn

  ```bash
  yarn add --dev @guanghechen/string
  ```

## Usage

* `transformer` utilities

  Name                  | Description
  :--------------------:|:---------------------------------------
  `toCamelCase`         | `'test string' => 'testString'`
  `toCapitalCase`       | `'test string' => 'Test String'`
  `toConstantCase`      | `'test string' => 'TEST_STRING'`
  `toDotCase`           | `'test string' => 'test.string'`
  `toKebabCase`         | `'test string' => 'test-string'`
  `toLowerCase`         | `'TEST STRING' => 'test string'`
  `toPascalCase`        | `'test string' => 'TestString'`
  `toPathCase`          | `'test string' => 'test/string'`
  `toSentenceCase`      | `'testString' => 'Test string'`
  `toSnakeCase`         | `'test string' => 'test_string'`
  `toTitleCase`         | `'a simple test' => 'A Simple Test'`
  `toUpperCase`         | `'test string' => 'TEST STRING'`

  - `composeTextTransformers`: Compose multiple ITextTransformer into one.

    ```typescript
    import {
      composeTextTransformers,
      toKebabCase,
      toTrim,
    } from '@guanghechen/string'

    // function composeTextTransformers (
    //   ...transformers: ReadonlyArray<ITextTransformer>
    // ): ITextTransformer

    const transform = composeTextTransformers(toTrim, toKebabCase)
    const text: string = transform(' TeSt_StrinG ')
    // => 'test-string'
    ```


[homepage]: https://github.com/guanghechen/sora/tree/@guanghechen/string@1.0.1/packages/string#readme
