<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/version@1.0.0/packages/version#readme">@guanghechen/version</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/version">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/version.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/version">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/version.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/version">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/version.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/version"
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

Lightweight semver version comparison utilities.

## Install

- npm

  ```bash
  npm install --save @guanghechen/version
  ```

- yarn

  ```bash
  yarn add @guanghechen/version
  ```

## Usage

### Parse and Compare Versions

```typescript
import { parseVersion, compareVersions, compareSemVer } from '@guanghechen/version'

// Parse a version string
const v = parseVersion('1.2.3-alpha.1')
// => { major: 1, minor: 2, patch: 3, prerelease: ['alpha', 1] }

// Compare version strings
compareVersions('1.2.3', '1.2.4')  // => -1
compareVersions('2.0.0', '1.9.9')  // => 1
compareVersions('1.0.0', '1.0.0')  // => 0

// Compare parsed versions
compareSemVer(
  { major: 1, minor: 0, patch: 0, prerelease: [] },
  { major: 2, minor: 0, patch: 0, prerelease: [] }
)  // => -1
```

### Check Version Ranges

```typescript
import { satisfies } from '@guanghechen/version'

// Exact version
satisfies('1.2.3', '1.2.3')  // => true

// Caret ranges (^)
satisfies('1.2.3', '^1.0.0')  // => true
satisfies('2.0.0', '^1.0.0')  // => false

// Tilde ranges (~)
satisfies('1.2.5', '~1.2.0')  // => true
satisfies('1.3.0', '~1.2.0')  // => false

// Comparison operators
satisfies('1.5.0', '>=1.0.0')  // => true
satisfies('1.5.0', '<2.0.0')   // => true
satisfies('1.5.0', '>1.0.0 <2.0.0')  // => true

// X-ranges
satisfies('1.2.3', '1.x')    // => true
satisfies('1.2.3', '1.2.x')  // => true

// Hyphen ranges
satisfies('1.5.0', '1.0.0 - 2.0.0')  // => true

// OR ranges
satisfies('3.0.0', '^1.0.0 || ^2.0.0 || ^3.0.0')  // => true

// Prerelease versions (includePrerelease defaults to true)
satisfies('1.0.0-alpha', '^1.0.0')  // => true

// Strict mode (node-semver compatible)
satisfies('1.0.0-alpha', '^1.0.0', { includePrerelease: false })  // => false
```

## API

### Types

```typescript
interface ISemVer {
  major: number
  minor: number
  patch: number
  prerelease: ReadonlyArray<string | number>
}

interface IPartialSemVer {
  major: number
  minor: number | undefined
  patch: number | undefined
  prerelease: ReadonlyArray<string | number>
  isWildcard?: boolean
}

interface ISatisfiesOptions {
  includePrerelease?: boolean  // default: true
}
```

### Functions

| Function                                              | Description                                    |
| ----------------------------------------------------- | ---------------------------------------------- |
| `parseVersion(version: string)`                       | Parse a full semver string to `ISemVer`        |
| `parsePartialVersion(version: string)`                | Parse a partial version to `IPartialSemVer`    |
| `compareVersions(v1: string, v2: string)`             | Compare two version strings (-1, 0, 1)         |
| `compareSemVer(v1: ISemVer, v2: ISemVer)`             | Compare two parsed versions (-1, 0, 1)         |
| `satisfies(version: string, range: string, options?)` | Check if version satisfies the range           |
| `formatVersion(v: ISemVer)`                           | Format a parsed version back to string         |
| `isFullVersion(v: IPartialSemVer)`                    | Check if partial version is a full version     |
| `toFullVersion(v: IPartialSemVer)`                    | Convert partial version to full (fill with 0s) |

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/version@1.0.0/packages/version#readme
