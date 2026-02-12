# Command - 核心 API

Command 是 CLI 应用的核心构建块，使用树形结构组织命令层级。

## 设计原则

1. **树形结构** — Command 是树节点，可独立运行或作为子命令挂载
2. **选项继承** — 子节点继承祖先链上所有选项，可通过 `long` 名覆盖
3. **显式依赖** — 不隐式访问 `process.argv` / `process.env`

## 类型定义

```typescript
interface ICommandConfig {
  name?: string           // 命令名称（仅 root 需要）
  description: string     // 命令描述
  version?: string        // 版本号（用于 --version）
  help?: boolean          // 是否启用 help 子命令
  reporter?: IReporter    // Reporter 实例
}

interface ICommandContext {
  cmd: ICommand                              // 当前命令节点
  envs: Record<string, string | undefined>   // 环境变量
  reporter: IReporter                        // Reporter 实例
  argv: string[]                             // 原始 argv
}

interface IActionParams {
  ctx: ICommandContext              // 执行上下文
  opts: Record<string, unknown>     // 解析后的选项
  args: Record<string, unknown>     // 解析后的位置参数
  rawArgs: string[]                 // 原始位置参数
}

type IAction = (params: IActionParams) => void | Promise<void>
```

## 方法

| 方法                                      | 说明         |
| ----------------------------------------- | ------------ |
| `.option(opt: IOption)`                   | 添加选项     |
| `.argument(arg: IArgument)`               | 添加位置参数 |
| `.action(fn: IAction)`                    | 设置 action  |
| `.subcommand(name: string, cmd: Command)` | 添加子命令   |
| `.run(params: IRunParams)`                | 解析 + 执行  |
| `.parse(argv: string[])`                  | 仅解析       |
| `.formatHelp()`                           | 生成帮助文本 |

## 树形结构示例

```typescript
const root = new Command({ name: 'pm', description: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose output' })

const start = new Command({ description: 'Start a process' })
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .option({ long: 'detach', short: 'd', type: 'boolean', description: 'Run in background' })
  .action(async ({ opts, args }) => {
    console.log(`Starting ${args.name}, verbose: ${opts.verbose}, detach: ${opts.detach}`)
  })

root.subcommand('start', start).subcommand('s', start)  // s 是 start 的别名
root.subcommand('stop', new Command({ description: 'Stop' }))

await root.run({ argv: process.argv.slice(2), envs: process.env })
```

```
pm (root)
├── start (aliases: s)
└── stop
```

## 选项继承

所有选项强制继承，子节点可通过 `long` 名覆盖。命令行输入使用 kebab-case（大小写不敏感）。

```typescript
const root = new Command({ name: 'cli', description: 'CLI' })
  .option({ long: 'logLevel', type: 'string', description: 'Log level' })

const sub = new Command({ description: 'Build' })
  .option({ long: 'logLevel', type: 'string', description: 'Build log level' })  // 覆盖

root.subcommand('build', sub)
// cli build --log-level debug  或  cli build --LOG-LEVEL debug
```

详见 [option.md](./option.md)。

## 位置参数

位置参数**不继承**，定义在叶子节点上。

```typescript
interface IArgument<T = unknown> {
  name: string                        // 参数名称
  description: string                 // 描述
  kind: 'required' | 'optional' | 'variadic'
  type?: 'string' | 'number'          // 值类型
  default?: T                         // 默认值（仅 optional）
  coerce?: (rawValue: string) => T    // 自定义转换
}
```

约束：

- `required` 必须在 `optional` 之前
- `variadic` 只能出现一次，且在最后
- `required` 不能有 `default`

```typescript
const cmd = new Command({ name: 'copy', description: 'Copy files' })
  .argument({ name: 'source', description: 'Source', kind: 'required' })
  .argument({ name: 'dest', description: 'Destination', kind: 'required' })
  .argument({ name: 'extras', description: 'Extra files', kind: 'variadic' })
```

## 执行流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                         run({ argv, envs })                         │
│                                                                     │
│  1. 命令路由：从左到右扫描，遇到 -/-- 开头即停止                    │
│                                                                     │
│  2. Token 预处理：argv → ICommandToken[]                            │
│     - 长选项：kebab-case → camelCase（值部分保持原样）              │
│     - --no-xxx：转为 --xxx=false                                    │
│     - 短选项、位置参数、-- 后内容：original === resolved            │
│                                                                     │
│  3. 选项解析：合并祖先链，resolver > coerce > 内置解析器            │
│                                                                     │
│  4. 校验：required / choices / type / unknown option                │
│                                                                     │
│  5. Apply：按顺序调用 apply(value, ctx)                             │
│                                                                     │
│  6. 参数解析：校验 required / variadic 约束                         │
│                                                                     │
│  7. 执行 action                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 命令路由

**命令路径必须在任何选项之前完全确定。**

```bash
pm start --verbose myapp    # ✅ 先路由到 start
pm --verbose start myapp    # ❌ start 被视为位置参数
pm -h start                 # ❌ 只触发 root help
pm -- start                 # ✅ start 作为位置参数
```

路由停止后，位置参数可与选项自由混合：

```bash
cli arg1 --opt val arg2     # ✅ 位置参数可分散在选项两侧
cli sub -- --like-option    # --like-option 作为位置参数
```

## 内置选项

| 选项        | 短选项 | 说明                |
| ----------- | ------ | ------------------- |
| `--help`    | `-h`   | 显示帮助并退出      |
| `--version` | `-V`   | 显示版本（仅 root） |

用户可定义同名选项覆盖默认行为。

## help 子命令

通过 `help: true` 启用：

```typescript
const root = new Command({ name: 'cli', description: 'CLI', help: true })
```

```bash
cli help           # 显示 cli 帮助
cli help init      # 显示 init 子命令帮助
```

启用时不能注册名为 `help` 的子命令。

## 帮助输出格式

```
Process Manager

Usage: pm [options] [command]

Options:
  -v, --verbose       Verbose output
      --no-verbose    Negate --verbose
  -h, --help          Show help information
  -V, --version       Show version number

Commands:
  start, s            Start a process
  stop                Stop a process
```

## 完整示例

```typescript
import { Command, CompletionCommand } from '@guanghechen/commander'

const pm = new Command({ name: 'pm', description: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose' })
  .option({ long: 'config', short: 'c', type: 'string', description: 'Config file' })

const start = new Command({ description: 'Start a process' })
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .option({ long: 'detach', short: 'd', type: 'boolean', description: 'Run in background' })
  .action(async ({ opts, args }) => {
    console.log(`Starting ${args.name}...`)
  })

pm.subcommand('start', start).subcommand('s', start)
pm.subcommand('completion', new CompletionCommand(pm))

await pm.run({ argv: process.argv.slice(2), envs: process.env })
```

```bash
pm start myapp --detach
pm start --verbose myapp -d
pm s myapp
pm start --no-verbose myapp
pm completion --bash > ~/.local/share/bash-completion/completions/pm
```
