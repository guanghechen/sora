<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/scheduler@6.0.8/packages/scheduler#readme">@guanghechen/scheduler</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/scheduler">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/scheduler.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/scheduler">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/scheduler.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/scheduler">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/scheduler.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/scheduler"
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

Task scheduler for managing and executing tasks with pipeline support.

## Install

- npm

  ```bash
  npm install --save @guanghechen/scheduler
  ```

- yarn

  ```bash
  yarn add @guanghechen/scheduler
  ```

## Usage

|       Name      |                        Description                        |
| :-------------: | :-------------------------------------------------------: |
|   `Scheduler`   |     Task scheduler with pipeline and strategy support    |
|   `Pipeline`    |     Processing pipeline for transforming data            |

## Example

- Basic scheduler:

  ```typescript
  import { Scheduler, Pipeline } from '@guanghechen/scheduler'
  import { TaskStrategyEnum } from '@guanghechen/task'

  // Create a pipeline for processing items
  const pipeline = new Pipeline<string, string>('my-pipeline')

  // Add material cookers to the pipeline
  pipeline.use({
    name: 'uppercase-cooker',
    cook: async (data, embryo, api, next) => {
      const processed = data.toUpperCase()
      return next(processed)
    }
  })

  // Create scheduler
  const scheduler = new Scheduler({
    name: 'my-scheduler',
    pipeline,
    strategy: TaskStrategyEnum.CONCURRENT
  })

  // Process items
  await pipeline.push('hello')
  await pipeline.push('world')

  // Start processing
  await scheduler.start()
  ```

- Custom pipeline with multiple stages:

  ```typescript
  import { Pipeline } from '@guanghechen/scheduler'

  interface DataItem {
    id: number
    content: string
  }

  const pipeline = new Pipeline<DataItem, string>('processing-pipeline')

  pipeline.use({
    name: 'validator',
    cook: async (data, embryo, api, next) => {
      // Stage 1: Validate
      if (!data.content) {
        throw new Error('Content is required')
      }
      return next(data)
    }
  })

  pipeline.use({
    name: 'transformer',
    cook: async (data, embryo, api, next) => {
      // Stage 2: Transform
      const transformed = `[${data.id}] ${data.content.trim()}`
      return next(transformed)
    }
  })

  pipeline.use({
    name: 'logger',
    cook: async (data, embryo, api, next) => {
      // Stage 3: Output
      console.log('Processed:', data)
      return data
    }
  })
  ```

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/scheduler@6.0.8/packages/scheduler#readme