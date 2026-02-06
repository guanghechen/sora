# Command - 核心 API

Command 是 CLI 应用的核心构建块，使用树形结构组织命令层级。

## 设计原则

1. **树形结构** — Command 是树节点，可独立运行或作为子命令挂载
2. **选项继承** — 子节点继承祖先链上的所有选项，可通过 `long` 名覆盖
3. **解耦设计** — 不隐式访问 `process.argv` / `process.env`，需显式传入

## 核心模型

```
Command (TreeNode)
├── identity: name, aliases[], description, version?
├── definition: options[], arguments[]
├── tree: parent?, subcommands[]
├── behavior: action?
└── inheritance: 选项沿祖先链继承，子节点可覆盖
```

## 类型定义

```typescript
/** 命令配置 */
interface ICommandConfig {
  /** 命令名称（用于路由匹配） */
  name: string
  /** 命令别名 */
  aliases?: string[]
  /** 命令描述 */
  description: string
  /** 版本号（仅对根命令生效） */
  version?: string
}

/** 执行上下文 */
interface ICommandContext {
  /** 当前执行的命令节点 */
  cmd: Command
  /** 传入的环境变量 */
  envs: Record<string, string | undefined>
  /** Reporter 实例 */
  reporter: IReporter
  /** 原始 argv */
  argv: string[]
}

/** Action 参数 */
interface IActionParams {
  /** 执行上下文 */
  ctx: ICommandContext
  /** 解析后的选项 */
  opts: Record<string, unknown>
  /** 解析后的位置参数 */
  args: string[]
}

/** Action 处理函数 */
type IAction = (params: IActionParams) => void | Promise<void>
```

## 构造

```typescript
import { Command } from '@guanghechen/commander'

const cmd = new Command({
  name: 'build',
  aliases: ['b'],
  description: 'Build the project',
})
```

## 属性

| 属性          | 类型          | 说明                   |
| ------------- | ------------- | ---------------------- |
| `name`        | `string`      | 命令名称               |
| `aliases`     | `string[]`    | 命令别名               |
| `description` | `string`      | 命令描述               |
| `version`     | `string?`     | 版本号（沿祖先链查找） |
| `parent`      | `Command?`    | 父节点                 |
| `options`     | `IOption[]`   | 当前节点定义的选项     |
| `arguments`   | `IArgument[]` | 当前节点定义的参数     |

## 方法

### 定义

| 方法                        | 说明         |
| --------------------------- | ------------ |
| `.option(opt: IOption)`     | 添加选项定义 |
| `.argument(arg: IArgument)` | 添加参数定义 |
| `.action(fn: IAction)`      | 设置 action  |

### 组装

| 方法                        | 说明       |
| --------------------------- | ---------- |
| `.subcommand(cmd: Command)` | 添加子命令 |

### 执行

| 方法                       | 说明                             |
| -------------------------- | -------------------------------- |
| `.run(params: IRunParams)` | 解析 + 执行（入口方法）          |
| `.parse(argv: string[])`   | 解析 argv，返回 `{ opts, args }` |
| `.formatHelp()`            | 生成帮助文本                     |

```typescript
/** run 方法参数 */
interface IRunParams {
  /** 命令行参数（通常为 process.argv.slice(2)） */
  argv: string[]
  /** 环境变量（通常为 process.env） */
  envs: Record<string, string | undefined>
}
```

## 树形结构

```typescript
const root = new Command({ name: 'pm', description: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose output' })

const start = new Command({ name: 'start', aliases: ['s'], description: 'Start a process' })
  .option({ long: 'detach', short: 'd', type: 'boolean', description: 'Run in background' })
  .action(async ({ ctx, opts, args }) => {
    // opts.verbose: 继承自 root
    // opts.detach: 当前节点定义
  })

const stop = new Command({ name: 'stop', description: 'Stop a process' })
  .action(async ({ ctx, opts, args }) => {
    // ...
  })

root.subcommand(start)
root.subcommand(stop)

await root.run({ argv: process.argv.slice(2), envs: process.env })
```

命令树结构：

```
pm (root)
├── start (aliases: s)
└── stop
```

执行示例：

```bash
pm start --verbose --detach   # 匹配 pm -> start
pm s -d                       # 等价（使用别名和短选项）
pm stop                       # 匹配 pm -> stop
```

## 选项继承

所有选项强制继承，子节点可通过 `long` 名覆盖。

```typescript
const root = new Command({ name: 'cli', description: 'My CLI' })
  .option({ long: 'log-level', type: 'string', description: 'Log level' })

const sub = new Command({ name: 'build', description: 'Build' })
  .option({
    long: 'log-level',  // 覆盖 root 的定义
    type: 'string',
    description: 'Build log level',
    resolver: customResolver,  // 使用不同的 resolver
  })

root.subcommand(sub)
```

详见 [option.md](./option.md)。

## 位置参数

位置参数定义在叶子节点上，**不继承**。

```typescript
interface IArgument {
  /** 参数名称 */
  name: string
  /** 参数描述 */
  description: string
  /** 参数类型：required / optional / variadic */
  kind: 'required' | 'optional' | 'variadic'
}
```

约束：

- `required` 必须在 `optional` 之前
- `variadic` 只能出现一次，且必须在最后
- 子命令存在时，父命令的 arguments 不参与解析

```typescript
const cmd = new Command({ name: 'copy', description: 'Copy files' })
  .argument({ name: 'source', description: 'Source file', kind: 'required' })
  .argument({ name: 'dest', description: 'Destination', kind: 'required' })
  .argument({ name: 'extras', description: 'Extra files', kind: 'variadic' })
```

## Action

Action 是命令的执行逻辑：

```typescript
.action(async ({ ctx, opts, args }) => {
  // ctx.cmd: 当前命令节点
  // ctx.envs: 传入的环境变量
  // ctx.reporter: Reporter 实例
  // ctx.argv: 原始 argv

  // opts: 解析后的选项（已合并祖先链）
  // args: 解析后的位置参数
})
```

## 执行流程

```
┌───────────────────────────────────────────────────────────────┐
│                       run({ argv, envs })                     │
│                                                               │
│  1. 命令路由：找到目标命令节点                                │
│     - 从左到右扫描 argv，按 name 或 aliases 匹配              │
│     - 遇到 `-` 或 `--` 开头的 token 时停止路由                │
│     - 遇到非子命令 token 时停止路由                           │
│                                                               │
│  2. 选项解析（三层机制）：                                    │
│     - 合并祖先链上的所有选项（子覆盖父）                      │
│     - 有 resolver：resolver 完全接管                          │
│     - 有 coerce：内置解析器 + coerce 转换                     │
│     - 无两者：内置解析器                                      │
│     - 生成 opts: Record<string, unknown>                      │
│                                                               │
│  3. 选项校验：                                                │
│     - required / choices 对所有选项生效（含 resolver）        │
│     - type 校验仅对内置解析器生效                             │
│                                                               │
│  4. Apply 回调：                                              │
│     - 按选项顺序调用每个选项的 apply(value, ctx)              │
│     - 将选项值应用到 context                                  │
│                                                               │
│  5. 参数解析：                                                │
│     - 收集剩余 argv 作为位置参数                              │
│     - 校验 required / variadic 约束                           │
│                                                               │
│  6. 执行 action：                                             │
│     - 调用 action({ ctx, opts, args })                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## 命令路由规则

路由在选项解析之前确定目标命令节点。

### 核心原则

**命令路径必须在任何 options 之前完全确定。**

路由从左到右扫描 argv，遇到 `-` 或 `--` 开头的 token 即停止。

```bash
pm start --verbose myapp    # ✅ 正确：先确定命令路径 (pm -> start)，再解析选项
pm --verbose start myapp    # ❌ 错误：遇到 --verbose 时路由停止，start 被视为位置参数
```

### Token 扫描

从左到右扫描 argv：

1. 遇到 `-` 或 `--` 开头的 token → 停止路由
2. 遇到子命令名/别名 → 切换到该子命令，继续扫描
3. 遇到非子命令的 token → 停止路由
4. 扫描结束 → 当前命令即为目标命令

### End-of-options (`--`)

- 路由时遇到 `--`，立即停止路由
- `--` 之后的 token 全部作为位置参数

### 停止条件

- 遇到 `-` 或 `--` 开头的 token 时停止路由
- 遇到非子命令名/别名的 token 时停止路由
- 已解析的命令路径成为目标命令

## 内置选项

Command 创建时自动挂载以下选项：

| 选项        | 短选项 | 说明           |
| ----------- | ------ | -------------- |
| `--help`    | `-h`   | 显示帮助并退出 |
| `--version` | `-V`   | 显示版本并退出 |

用户可通过定义同名选项覆盖默认行为。

## 选项唯一性校验

调用 `.option()` 时检查 `long` 和 `short` 是否已存在于当前 Command 的直接选项中：

```typescript
const cmd = new Command({ name: 'test', description: 'Test' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose' })
  .option({ long: 'verbose', type: 'boolean', description: 'Duplicate' })
  // Error: Option --verbose is already defined

const cmd2 = new Command({ name: 'test', description: 'Test' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose' })
  .option({ long: 'version', short: 'v', type: 'boolean', description: 'Version' })
  // Error: Short option -v is already defined
```

注意：这只检查当前 Command 的直接选项，不检查祖先链（祖先链中的同名选项视为合法覆盖）。

## 帮助输出格式

```
Process Manager

Usage: pm [options] [command]

Options:
  -v, --verbose       Verbose output
      --no-verbose    Disable verbose output
  -h, --help          Show help information
  -V, --version       Show version number

Commands:
  start, s            Start a process
  stop                Stop a process
```

## 完整示例

```typescript
import { Command, CompletionCommand } from '@guanghechen/commander'

// 根命令
const pm = new Command({
  name: 'pm',
  description: 'Process Manager',
  version: '1.0.0',
})
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose output' })
  .option({ long: 'config', short: 'c', type: 'string', description: 'Config file' })

// start 子命令
const start = new Command({
  name: 'start',
  aliases: ['s'],
  description: 'Start a process',
})
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .option({ long: 'detach', short: 'd', type: 'boolean', description: 'Run in background' })
  .action(async ({ ctx, opts, args }) => {
    const [name] = args
    console.log(`Starting ${name}...`)
    console.log(`Verbose: ${opts.verbose}, Detach: ${opts.detach}`)
  })

// stop 子命令
const stop = new Command({
  name: 'stop',
  description: 'Stop a process',
})
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .action(async ({ ctx, opts, args }) => {
    const [name] = args
    console.log(`Stopping ${name}...`)
  })

// completion 子命令（内置）
const completion = new CompletionCommand(pm)

// 组装树
pm.subcommand(start)
pm.subcommand(stop)
pm.subcommand(completion)

// 运行
await pm.run({ argv: process.argv.slice(2), envs: process.env })
```

```bash
# 使用示例
pm start myapp --detach
pm start --verbose myapp -d
pm s myapp
pm stop myapp
pm start --no-verbose myapp   # verbose = false
pm completion --bash > ~/.local/share/bash-completion/completions/pm
```
