# Command - 核心 API

Command 是 CLI 应用的核心构建块，使用树形结构组织命令层级。

## 设计原则

1. **树形结构** — Command 是树节点，可独立运行或作为子命令挂载
2. **选项继承** — 子节点继承祖先链上的所有选项，可通过 `long` 名覆盖
3. **显式依赖** — 不隐式访问 `process.argv` / `process.env`，`argv` / `envs` / `reporter` 需显式提供

## 核心模型

```
Command (TreeNode)
├── identity: name, description, version?
├── definition: options[], arguments[]
├── tree: parent?, subcommands[] (name, aliases[], command)
├── behavior: action?
└── inheritance: 选项沿祖先链继承，子节点可覆盖
```

## 类型定义

```typescript
/** 命令配置 */
interface ICommandConfig {
  /** 命令名称（仅 root 需要，子命令由 subcommand 注册） */
  name?: string
  /** 命令描述 */
  description: string
  /** 版本号（用于 root 的内置 --version） */
  version?: string
  /** 是否启用内置 help 子命令 */
  help?: boolean
  /** Reporter 实例（默认 console reporter） */
  reporter?: IReporter
}

/** 命令只读视图 */
interface ICommand {
  /** 命令名称 */
  name: string
  /** 命令描述 */
  description: string
  /** 版本号 */
  version?: string
  /** 父节点 */
  parent?: ICommand
  /** 当前节点定义的选项 */
  options: IOption[]
  /** 当前节点定义的参数 */
  arguments: IArgument[]
}

/** 执行上下文 */
interface ICommandContext {
  /** 当前执行的命令节点 */
  cmd: ICommand
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
  /** 解析后的位置参数（按参数名索引） */
  args: Record<string, unknown>
  /** 原始位置参数字符串（类型转换前） */
  rawArgs: string[]
}

/** Action 处理函数 */
type IAction = (params: IActionParams) => void | Promise<void>

/** parse() 方法结果 */
interface IParseResult {
  /** 解析后的选项 */
  opts: Record<string, unknown>
  /** 解析后的位置参数（按参数名索引） */
  args: Record<string, unknown>
  /** 原始位置参数字符串 */
  rawArgs: string[]
}
```

## 构造

```typescript
import { Command } from '@guanghechen/commander'

const cmd = new Command({
  name: 'build',
  description: 'Build the project',
})
```

`reporter` 在构造时传入；未提供时使用默认 console reporter。`run` 可通过参数覆盖。

## 属性

| 属性          | 类型          | 说明               |
| ------------- | ------------- | ------------------ |
| `name`        | `string`      | 命令名称           |
| `description` | `string`      | 命令描述           |
| `version`     | `string?`     | 版本号             |
| `parent`      | `ICommand?`   | 父节点             |
| `options`     | `IOption[]`   | 当前节点定义的选项 |
| `arguments`   | `IArgument[]` | 当前节点定义的参数 |

## 方法

### 定义

| 方法                        | 说明         |
| --------------------------- | ------------ |
| `.option(opt: IOption)`     | 添加选项定义 |
| `.argument(arg: IArgument)` | 添加参数定义 |
| `.action(fn: IAction)`      | 设置 action  |

### 组装

| 方法                                      | 说明       |
| ----------------------------------------- | ---------- |
| `.subcommand(name: string, cmd: Command)` | 添加子命令 |

### 执行

| 方法                       | 说明                    |
| -------------------------- | ----------------------- |
| `.run(params: IRunParams)` | 解析 + 执行（入口方法） |
| `.parse(argv: string[])`   | 解析 argv（先路由）     |
| `.formatHelp()`            | 生成帮助文本            |

```typescript
/** run 方法参数 */
interface IRunParams {
  /** 命令行参数（通常为 process.argv.slice(2)） */
  argv: string[]
  /** 环境变量（通常为 process.env） */
  envs: Record<string, string | undefined>
  /** 可选 reporter 覆盖 */
  reporter?: IReporter
}
```

`parse` 与 `run`
共享路由逻辑：先确定命令链条，再由 leaf 节点解析 options/args（options 自下而上消费），不执行 action。返回
`{ opts, args, rawArgs }`。

## 树形结构

```typescript
const root = new Command({ name: 'pm', description: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose output' })

const start = new Command({ description: 'Start a process' })
  .option({ long: 'detach', short: 'd', type: 'boolean', description: 'Run in background' })
  .action(async ({ ctx, opts, args }) => {
    // opts.verbose: 继承自 root
    // opts.detach: 当前节点定义
  })

const stop = new Command({ description: 'Stop a process' })
  .action(async ({ ctx, opts, args }) => {
    // ...
  })

root.subcommand('start', start).subcommand('s', start)
root.subcommand('stop', stop)

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

所有选项强制继承，子节点可通过 `long` 名覆盖。内置选项不参与继承；`--version` 默认仅 root 自动挂载。

`long` 是 option 的唯一身份标识；`short` 只是该 option 的 alias。子节点只有在覆盖同名 `long`
时才允许修改 `short`，不同 `long` 之间不允许共享同一个 `short`（包含祖先链）。

```typescript
const root = new Command({ name: 'cli', description: 'My CLI' })
  .option({ long: 'log-level', type: 'string', description: 'Log level' })

const sub = new Command({ description: 'Build' })
  .option({
    long: 'log-level',  // 覆盖 root 的定义
    type: 'string',
    description: 'Build log level',
    resolver: customResolver,  // 使用不同的 resolver
  })

root.subcommand('build', sub)
```

详见 [option.md](./option.md)。

## 位置参数

位置参数定义在叶子节点上，**不继承**。

```typescript
/** 参数值类型 */
type IArgumentType = 'string' | 'number'

interface IArgument<T = unknown> {
  /** 参数名称 */
  name: string
  /** 参数描述 */
  description: string
  /** 参数类型：required / optional / variadic */
  kind: 'required' | 'optional' | 'variadic'
  /** 值类型，默认 'string' */
  type?: IArgumentType
  /** 默认值（仅对 optional 有效） */
  default?: T
  /** 自定义转换（优先于 type 转换） */
  coerce?: (rawValue: string) => T
}
```

约束：

- `required` 必须在 `optional` 之前
- `variadic` 只能出现一次，且必须在最后
- `required` 不能有 `default` 值
- 子命令存在时，父命令的 arguments 不参与解析

```typescript
const cmd = new Command({ name: 'copy', description: 'Copy files' })
  .argument({ name: 'source', description: 'Source file', kind: 'required' })
  .argument({ name: 'dest', description: 'Destination', kind: 'required' })
  .argument({ name: 'extras', description: 'Extra files', kind: 'variadic' })
```

### 参数类型转换

参数支持 `type` 和 `coerce` 进行值转换：

```typescript
// 使用 type 进行内置转换
const cmd = new Command({ name: 'server', description: 'Start server' })
  .argument({ name: 'port', description: 'Port number', kind: 'required', type: 'number' })
  .action(({ args }) => {
    // args.port: number (已转换)
    console.log(`Listening on port ${args.port}`)
  })

// 使用 coerce 进行自定义转换
const cmd2 = new Command({ name: 'connect', description: 'Connect' })
  .argument({
    name: 'port',
    description: 'Port',
    kind: 'required',
    coerce: v => {
      const n = parseInt(v, 10)
      if (n < 0 || n > 65535) throw new Error('Invalid port')
      return n
    },
  })

// variadic + type: number → number[]
const cmd3 = new Command({ name: 'sum', description: 'Sum numbers' })
  .argument({ name: 'numbers', description: 'Numbers to sum', kind: 'variadic', type: 'number' })
  .action(({ args }) => {
    // args.numbers: number[]
    const sum = (args.numbers as number[]).reduce((a, b) => a + b, 0)
    console.log(`Sum: ${sum}`)
  })
```

### 参数默认值

仅 `optional` 参数支持 `default`：

```typescript
const cmd = new Command({ name: 'build', description: 'Build' })
  .argument({ name: 'env', description: 'Environment', kind: 'optional', default: 'development' })
  .action(({ args }) => {
    // 未提供时 args.env === 'development'
    // 提供时 args.env === 提供的值
  })
```

## Action

Action 是命令的执行逻辑：

```typescript
.action(async ({ ctx, opts, args, rawArgs }) => {
  // ctx.cmd: 当前命令节点
  // ctx.envs: 传入的环境变量
  // ctx.reporter: Reporter 实例
  // ctx.argv: 原始 argv

  // opts: 解析后的选项（已合并祖先链）
  // args: 解析后的位置参数（Record<string, unknown>，按参数名索引）
  // rawArgs: 原始位置参数字符串数组（类型转换前）

  // 示例：访问参数
  const name = args.name as string  // 通过参数名访问
  const port = args.port as number  // 已经过 type 转换
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
│     - 选项自下而上消费（leaf -> root）                        │
│     - 有 resolver：resolver 完全接管                          │
│     - 有 coerce：内置解析器 + coerce 转换                     │
│     - 无两者：内置解析器                                      │
│     - 生成 opts: Record<string, unknown>                      │
│     - 非选项 token 被收集为位置参数                           │
│                                                               │
│  3. 选项校验：                                                │
│     - required / choices 对所有选项生效（含 resolver）        │
│     - type 校验仅对内置解析器生效                             │
│                                                               │
│  4. 构建 context + Apply：                                    │
│     - ctx 包含 argv / envs / reporter                         │
│     - 按选项顺序调用每个选项的 apply(value, ctx)              │
│     - 将选项值应用到 context                                  │
│                                                               │
│  5. 参数解析：                                                │
│     - 合并选项解析中收集的位置参数 + `--` 后的 restArgs       │
│     - 校验 required / variadic 约束                           │
│                                                               │
│  6. 执行 action：                                             │
│     - 调用 action({ ctx, opts, args })                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## 命令路由规则

路由在选项解析之前确定目标命令节点。

### 核心原则（严格路由）

**命令路径必须在任何 options 之前完全确定。**

路由从左到右扫描 argv，遇到 `-` 或 `--` 开头的 token 即停止。

```bash
pm start --verbose myapp    # ✅ 正确：先确定命令路径 (pm -> start)，再解析选项
pm --verbose start myapp    # ❌ 错误：遇到 --verbose 时路由停止，start 被视为位置参数
pm -h start                 # ❌ 错误：路由停止，只会触发 root help
pm -- start                 # ✅ start 作为位置参数（不再参与路由）
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

### 位置参数与选项混合

前提：命令路径已确定（即不再有子命令 token）。位置参数可以与选项自由混合，不必放在 `--` 之后：

```bash
cli arg1                    # ✅ arg1 作为位置参数
cli sub arg1                # ✅ arg1 作为 sub 的位置参数
cli --opt val arg1          # ✅ 选项和位置参数混合
cli arg1 --opt val          # ✅ 位置参数可以在选项之前
cli arg1 --opt val arg2     # ✅ 位置参数可以分散在选项两侧
cli --opt val sub           # ❌ sub 被视为位置参数（不会参与路由）
```

选项解析完成后，剩余的非选项 token 被收集为位置参数。`--` 分隔符仍然有效：`--`
之后的内容不会被解析为选项。

```bash
cli sub arg -- --like-option    # arg 和 --like-option 都作为位置参数
cli sub -- --opt val            # --opt 和 val 都作为位置参数（不解析为选项）
```

## 内置选项

Command 创建时自动挂载以下选项（`--help` 对所有命令生效；`--version`
默认仅 root 自动挂载，且不参与继承）：

| 选项        | 短选项 | 说明           |
| ----------- | ------ | -------------- |
| `--help`    | `-h`   | 显示帮助并退出 |
| `--version` | `-V`   | 显示版本并退出 |

用户可通过定义同名选项覆盖默认行为。

`--version` 默认仅在 root 成为目标命令时生效（不参与继承）。子命令如需 `--version`
行为，需要显式定义同名选项并自行处理（例如在 action 中输出 version 并退出）。

## help subcommand

通过配置 `help: true` 启用 `help` 子命令功能。

```typescript
const root = new Command({
  name: 'cli',
  description: 'CLI tool',
  help: true,  // 启用 help subcommand
})
```

### 有子命令时的行为

```bash
cli help           # 显示 cli 的帮助信息
cli help init      # 显示 init 子命令的帮助信息
cli help unknown   # Error: unexpected argument "unknown"
```

帮助输出中会显示 `help` 作为可用子命令。

### 无子命令时的行为

即使没有子命令，`help: true` 也可以启用 `help` 子命令：

```bash
cli help           # 显示 cli 的帮助信息（等价于 cli --help）
cli help anything  # 显示 cli 的帮助信息（忽略后续参数）
```

此时 `help` 不会出现在帮助输出的 Commands 列表中（因为没有其他子命令）。

### 未启用时的行为

当 `help: false`（默认）且没有注册名为 `help` 的子命令时：

```bash
cli help           # help 被当作位置参数传入 action
cli help init      # help 和 init 都被当作位置参数
```

### 保留名称

启用 `help: true` 时，不能注册名为 `help` 的子命令或别名：

```typescript
const root = new Command({ name: 'cli', description: 'CLI', help: true })
root.subcommand('help', sub)  // Error: reserved subcommand name
```

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

注意：这只检查当前 Command 的直接选项，不检查祖先链（祖先链中的同名 `long`
视为合法覆盖）。合并祖先链时，若不同 `long` 使用相同 `short`，视为冲突；只有覆盖同名 `long`
时才允许修改 `short`。

## 帮助输出格式

```
Process Manager

Usage: pm [options] [command]

Options:
  -v, --verbose       Verbose output
      --no-verbose    Negate --verbose
  -h, --help          Show help information
      --no-help       Negate --help
  -V, --version       Show version number
      --no-version    Negate --version

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
  description: 'Start a process',
})
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .option({ long: 'detach', short: 'd', type: 'boolean', description: 'Run in background' })
  .action(async ({ ctx, opts, args }) => {
    const name = args.name as string
    console.log(`Starting ${name}...`)
    console.log(`Verbose: ${opts.verbose}, Detach: ${opts.detach}`)
  })

// stop 子命令
const stop = new Command({
  description: 'Stop a process',
})
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .action(async ({ ctx, opts, args }) => {
    const name = args.name as string
    console.log(`Stopping ${name}...`)
  })

// completion 子命令（内置）
const completion = new CompletionCommand(pm)

// 组装树
pm.subcommand('start', start).subcommand('s', start)
pm.subcommand('stop', stop)
pm.subcommand('completion', completion)

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
