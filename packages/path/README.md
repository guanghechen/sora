<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/path@2.0.0/packages/path#readme">@guanghechen/path</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/path">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/path.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/path">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/path.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/path">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/path.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/path"
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

Path utilities for file system operations with safe path resolution and workspace management.
Provides strict path validation to prevent directory traversal attacks.

## Install

- npm

  ```bash
  npm install --save @guanghechen/path
  ```

- yarn

  ```bash
  yarn add @guanghechen/path
  ```

## Usage

### PathResolver

Standard path resolver with safety checks:

```typescript
import { PathResolver, pathResolver } from '@guanghechen/path'

// Use the default singleton
pathResolver.normalize('/foo/bar/../baz') // '/foo/baz'
pathResolver.basename('/foo/bar/file.txt') // 'file.txt'
pathResolver.dirname('/foo/bar/file.txt') // '/foo/bar'
pathResolver.join('/foo', 'bar', 'baz') // '/foo/bar/baz'
pathResolver.relative('/foo/bar', '/foo/baz') // '../baz'

// Check if path is within a root directory (safe from traversal)
pathResolver.isSafeRelative('/workspace', '/workspace/src/file.ts') // true
pathResolver.isSafeRelative('/workspace', '/etc/passwd') // false

// Safe relative path (throws if unsafe)
pathResolver.safeRelative('/workspace', '/workspace/src/file.ts') // 'src/file.ts'

// Safe resolve (resolve relative path within root)
pathResolver.safeResolve('/workspace', './src/file.ts') // '/workspace/src/file.ts'
pathResolver.safeResolve('/workspace', '../outside') // throws Error

// Create custom resolver with slash preference
const resolver = new PathResolver({ preferSlash: true })
resolver.relative('/foo/bar', '/foo/baz') // '../baz' (uses forward slashes on Windows)
```

### WorkspacePathResolver

Workspace-scoped path operations:

```typescript
import { WorkspacePathResolver, pathResolver } from '@guanghechen/path'

const workspace = new WorkspacePathResolver('/project/workspace', pathResolver)

// Check if path is within workspace
workspace.isSafePath('/project/workspace/src/index.ts') // true
workspace.isSafePath('/etc/passwd') // false

// Resolve relative paths within workspace
workspace.resolve('./src/index.ts') // '/project/workspace/src/index.ts'
workspace.resolve('package.json') // '/project/workspace/package.json'

// Get relative path from workspace root
workspace.relative('/project/workspace/src/index.ts') // 'src/index.ts'
```

### UrlPathResolver

URL-style path resolution (forward slashes):

```typescript
import { UrlPathResolver, urlPathResolver } from '@guanghechen/path'

urlPathResolver.normalize('/foo/bar/../baz') // '/foo/baz'
urlPathResolver.join('/api', 'users', '123') // '/api/users/123'
```

### Locate Utilities

Find files by traversing up the directory tree:

```typescript
import { locateNearestFilepath, findNearestFilepath } from '@guanghechen/path'

// Find nearest file by name(s)
const packageJson = locateNearestFilepath('/project/src/utils', 'package.json')
// Returns: '/project/package.json' (if exists)

// Find nearest file matching multiple names
const config = locateNearestFilepath('/project/src', [
  'tsconfig.json',
  'jsconfig.json',
])

// Find nearest file with custom predicate
const readme = findNearestFilepath('/project/src', (filepath) => {
  return filepath.toLowerCase().endsWith('readme.md')
})
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/path@2.0.0/packages/path#readme
