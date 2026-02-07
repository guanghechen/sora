<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/config@2.0.0/packages/config#readme">@guanghechen/config</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/config">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/config.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/config">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/config.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/config">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/config.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/config"
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

Utilities for defining versioned configuration with integrity verification. Provides base classes
for managing configuration data with semantic versioning compatibility checks, MAC (Message
Authentication Code) validation, and resource-based persistence.

## Install

- npm

  ```bash
  npm install --save @guanghechen/config
  ```

- yarn

  ```bash
  yarn add @guanghechen/config
  ```

## Usage

### Using PlainJsonConfigKeeper

For simple JSON configurations without custom serialization:

```typescript
import { PlainJsonConfigKeeper } from '@guanghechen/config'
import type { ITextResource } from '@guanghechen/types'

interface IAppConfig {
  theme: 'light' | 'dark'
  language: string
  autoSave: boolean
}

// Create a text resource (e.g., file-based)
const resource: ITextResource = {
  load: async () => { /* read from file */ },
  save: async (content: string) => { /* write to file */ },
  destroy: async () => { /* cleanup */ },
}

const keeper = new PlainJsonConfigKeeper<IAppConfig>({ resource })

// Load existing config
const config = await keeper.load()
console.log(config.theme) // 'light'

// Update and save
await keeper.update({ ...config, theme: 'dark' })
await keeper.save()
```

### Creating Custom ConfigKeeper

For configurations requiring custom serialization/deserialization:

```typescript
import { JsonConfigKeeper } from '@guanghechen/config'
import type { ITextResource } from '@guanghechen/types'

// Runtime instance type
interface IUserSettings {
  username: string
  createdAt: Date
  preferences: Map<string, string>
}

// Serializable data type (JSON-compatible)
interface IUserSettingsData {
  username: string
  createdAt: string // ISO date string
  preferences: Array<[string, string]>
}

class UserSettingsKeeper extends JsonConfigKeeper<IUserSettings, IUserSettingsData> {
  public readonly __version__ = '1.0.0'
  public readonly __compatible_version__ = '~1.0.0' // semver range

  protected async serialize(instance: IUserSettings): Promise<IUserSettingsData> {
    return {
      username: instance.username,
      createdAt: instance.createdAt.toISOString(),
      preferences: Array.from(instance.preferences.entries()),
    }
  }

  protected async deserialize(data: IUserSettingsData): Promise<IUserSettings> {
    return {
      username: data.username,
      createdAt: new Date(data.createdAt),
      preferences: new Map(data.preferences),
    }
  }
}

const keeper = new UserSettingsKeeper({ resource })

// Load, modify, save
const settings = await keeper.load()
settings.preferences.set('fontSize', '14px')
await keeper.update(settings)
await keeper.save()
```

### Version Compatibility

The config keeper enforces version compatibility using semantic versioning:

```typescript
class MyConfigKeeper extends JsonConfigKeeper<MyInstance, MyData> {
  public readonly __version__ = '2.1.0'
  public readonly __compatible_version__ = '^2.0.0' // accepts 2.x.x

  // ... serialize/deserialize implementations
}

const keeper = new MyConfigKeeper({ resource })

// Check version compatibility manually
if (keeper.compatible('2.0.5')) {
  console.log('Version is compatible')
}
```

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/config@2.0.0/packages/config#readme
