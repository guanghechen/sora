<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/std@1.0.4/packages/std#readme">@guanghechen/std</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/std">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/std.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/std">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/std.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/std">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/std.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/std"
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

Standard utility functions.

## Install

- npm

  ```bash
  npm install --save-dev @guanghechen/std
  ```

- yarn

  ```bash
  yarn add --dev @guanghechen/std
  ```

## Usage

- is

  Name                  | Description
  :--------------------:|:----------------------------------------------------------------
  `isArray`             | Check if the given data is a `Array` type
  `isBigint`            | Check if the given data is a `bigint` type
  `isBoolean`           | Check if the given data is a `boolean` / `Boolean` type
  `isDate`              | Check if the given data is a `Date` type
  `isFunction`          | Check if the given data is a `Function` type
  `isInteger`           | Check if the given data is a `Integer` type
  `isNumber`            | Check if the given data is a `number` / `Number` type
  `isObject`            | Check if the given data is a `Object` type
  `isString`            | Check if the given data is a `string` / `String` type
  `isSymbol`            | Check if the given data is a `symbol` type
  `isUndefined`         | Check if the given data is a `undefined` type
  `isPlainObject`       | Check if the given value is a plain object.
  `isPrimitiveBoolean`  | Check if the given data is a `boolean` type
  `isPrimitiveInteger`  | Check if the given data is a `integer` type
  `isPrimitiveNumber`   | Check if the given data is a `number` type
  `isPrimitiveString`   | Check if the given data is a `string` type
  `isNonBlankString`    | Check if the given data is an non-blank `string` / `String` type
  `isNotEmptyArray`     | Check if the given data is an not-empty `Array` type
  `isNotEmptyObject`    | Check if the given data is an not-empty `Object` type
  `isEmptyObject`       | Check if the given data is an empty `Object` type
  `isNumberLike`        | Check if the given data is an `number` / `Number` or number like `string` type

- string `transformer` utilities

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
    import { composeTextTransformers, toKebabCase, toTrim } from '@guanghechen/std'

    // function composeTextTransformers (
    //   ...transformers: ReadonlyArray<ITextTransformer>
    // ): ITextTransformer

    const transform = composeTextTransformers(toTrim, toKebabCase)
    const text: string = transform(' TeSt_StrinG ')
    // => 'test-string'
    ```



[homepage]: https://github.com/guanghechen/sora/tree/@guanghechen/std@1.0.4/packages/std#readme
