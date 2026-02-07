<header>
  <h1 align="center">
    <a href="https://github.com/guanghechen/sora/tree/@guanghechen/task@2.0.0/packages/task#readme">@guanghechen/task</a>
  </h1>
  <div align="center">
    <a href="https://www.npmjs.com/package/@guanghechen/task">
      <img
        alt="Npm Version"
        src="https://img.shields.io/npm/v/@guanghechen/task.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/task">
      <img
        alt="Npm Download"
        src="https://img.shields.io/npm/dm/@guanghechen/task.svg"
      />
    </a>
    <a href="https://www.npmjs.com/package/@guanghechen/task">
      <img
        alt="Npm License"
        src="https://img.shields.io/npm/l/@guanghechen/task.svg"
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
        src="https://img.shields.io/node/v/@guanghechen/task"
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

Atomic and resumable tasks implementation with observable status tracking. Provides two task types:
`AtomicTask` for one-shot operations and `ResumableTask` for pausable/resumable operations.

## Install

- npm

  ```bash
  npm install --save @guanghechen/task
  ```

- yarn

  ```bash
  yarn add @guanghechen/task
  ```

## Usage

### AtomicTask

For tasks that run to completion without pause/resume support:

```typescript
import { AtomicTask, TaskStatusEnum, TaskStrategyEnum } from '@guanghechen/task'
import { Subscriber } from '@guanghechen/subscriber'

class DownloadTask extends AtomicTask {
  private readonly url: string

  constructor(url: string) {
    super('download-task', TaskStrategyEnum.ABORT_ON_ERROR)
    this.url = url
  }

  protected async run(): Promise<void> {
    // Perform the download operation
    console.log(`Downloading from ${this.url}`)
    await fetch(this.url)
    console.log('Download complete')
  }
}

const task = new DownloadTask('https://example.com/file')

// Subscribe to status changes
const subscriber = new Subscriber({
  onNext: (status) => {
    console.log('Status:', TaskStatusEnum[status])
  }
})
task.status.subscribe(subscriber)

// Start the task
await task.start()

// Or run to completion
await task.complete()

// Check for errors
if (task.errors.length > 0) {
  console.error('Task failed:', task.errors)
}
```

### ResumableTask

For tasks that can be paused and resumed:

```typescript
import { ResumableTask, TaskStatusEnum, TaskStrategyEnum } from '@guanghechen/task'

class BatchProcessTask extends ResumableTask {
  private readonly items: string[]

  constructor(items: string[]) {
    super('batch-process', TaskStrategyEnum.CONTINUE_ON_ERROR, 100) // 100ms poll interval
    this.items = items
  }

  protected *run(): IterableIterator<Promise<void>> {
    for (const item of this.items) {
      yield this.processItem(item)
    }
  }

  private async processItem(item: string): Promise<void> {
    console.log(`Processing: ${item}`)
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

const task = new BatchProcessTask(['item1', 'item2', 'item3'])

// Start the task
await task.start()

// Pause after some time
setTimeout(async () => {
  await task.pause()
  console.log('Task paused')

  // Resume later
  setTimeout(async () => {
    await task.resume()
    console.log('Task resumed')
  }, 2000)
}, 1000)
```

### Task Status

Tasks have observable status with the following states:

| Status               | Description                          |
| :------------------: | :----------------------------------: |
| `PENDING`            | Task not started                     |
| `RUNNING`            | Task is running                      |
| `SUSPENDED`          | Task is paused (ResumableTask only)  |
| `CANCELLED`          | Task was cancelled                   |
| `FAILED`             | Task failed with errors              |
| `COMPLETED`          | Task completed successfully          |
| `ATTEMPT_SUSPENDING` | Attempting to pause                  |
| `ATTEMPT_RESUMING`   | Attempting to resume                 |
| `ATTEMPT_CANCELING`  | Attempting to cancel                 |
| `ATTEMPT_COMPLETING` | Attempting to complete               |

### Task Strategy

| Strategy            | Description                                    |
| :-----------------: | :--------------------------------------------: |
| `ABORT_ON_ERROR`    | Stop task execution when an error occurs       |
| `CONTINUE_ON_ERROR` | Continue execution despite errors              |

## Reference

- [homepage][homepage]

[homepage]:
  https://github.com/guanghechen/sora/tree/@guanghechen/task@2.0.0/packages/task#readme
