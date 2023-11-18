<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/equal@1.0.0-alpha.3/packages/equal#readme">@guanghechen/equal</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/equal">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/equal.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/equal">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/equal.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/equal">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/equal.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/equal"
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


Inspired by https://github.com/epoberezkin/fast-deep-equal, re-publish cause it's not support ESM.


## Usage

* use within ESM.

  ```javascript
  import isEqual from '@guanghechen/equal'
  console.log(isEqual({foo: 'bar'}, {foo: 'bar'})); // true
  ```

* use within CommonJS.

  ```javascript
  const isEqual = require('@guanghechen/equal')
  console.log(isEqual({foo: 'bar'}, {foo: 'bar'})); // true
  ```
