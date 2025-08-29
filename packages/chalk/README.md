<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/chalk@1.0.4/packages/chalk#readme">@guanghechen/chalk</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/chalk">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/chalk.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/chalk">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/chalk.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/chalk">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/chalk.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/chalk"
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

Terminal string styling with support for both Node.js and browser environments. Forked from the original chalk library.

## Install

- npm

  ```bash
  npm install --save @guanghechen/chalk
  ```

- yarn

  ```bash
  yarn add @guanghechen/chalk
  ```

## Usage

|       Name       |                        Description                        |
| :--------------: | :-------------------------------------------------------: |
|     `Chalk`      |     Main class for creating chalk instances with levels  |
|     `chalk`      |              Pre-configured chalk instance (node)        |
|  `chalkStderr`   |        Pre-configured chalk instance for stderr          |
| `hex2rgb` etc.   |              Color conversion utility functions           |

## Example

- Basic styling:

  ```typescript
  import { Chalk, ColorSupportLevelEnum } from '@guanghechen/chalk'

  const chalk = Chalk.create(ColorSupportLevelEnum.True16m)
  console.log(chalk.red('Error message'))
  console.log(chalk.green.bold('Success!'))
  console.log(chalk.blue.underline('Link text'))
  ```

- Using pre-configured instances:

  ```typescript
  import { chalk } from '@guanghechen/chalk/node'
  // or import { chalk } from '@guanghechen/chalk/browser'

  console.log(chalk.red('Error message'))
  console.log(chalk.green('Success!'))
  ```

- Custom colors:

  ```typescript
  import { Chalk, ColorSupportLevelEnum } from '@guanghechen/chalk'

  const chalk = Chalk.create(ColorSupportLevelEnum.True16m)

  // Hex colors
  console.log(chalk.hex('#FF5733')('Orange text'))
  
  // RGB colors  
  console.log(chalk.rgb(255, 87, 51)('Orange text'))
  
  // 256-color ANSI
  console.log(chalk.ansi256(196)('Red text'))

  // Background colors
  console.log(chalk.bgHex('#FF5733')('Background orange'))
  console.log(chalk.bgRgb(255, 87, 51)('Background orange'))
  ```

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/chalk@1.0.4/packages/chalk#readme