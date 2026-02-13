# Command

Command 是 CLI 应用的核心构建块，使用树形结构组织命令层级。

---

## 设计原则

1. **树形结构** — Command 是树节点，可独立运行或作为子命令挂载
2. **选项继承** — 子节点继承祖先链上所有选项，可通过 `long` 名覆盖
3. **显式依赖** — 不隐式访问 `process.argv` / `process.env`

---

## 类型定义

```typescript
/** Command 实例接口 */
interface ICommand {
  readonly name: string | undefined
  readonly description: string
  readonly parent: ICommand | undefined
  readonly options: ICommandOptionConfig[]
  readonly arguments: ICommandArgumentConfig[]
  readonly subcommands: Map<string, ICommand>
}

/** Command 构造配置 */
interface ICommandConfig {
  name?: string           // 命令名称（仅 root 需要）
  description: string     // 命令描述
  version?: string        // 版本号（用于 --version）
  help?: boolean          // 是否启用 help 子命令
  reporter?: IReporter    // Reporter 实例（来自 @guanghechen/reporter）
}

/** 执行上下文 */
interface ICommandContext {
  cmd: ICommand                              // 当前命令节点
  envs: Record<string, string | undefined>   // 环境变量
  reporter: IReporter                        // Reporter 实例
  argv: string[]                             // 原始 argv
}

/** action 回调参数 */
interface ICommandActionParams {
  ctx: ICommandContext              // 执行上下文
  opts: Record<string, unknown>     // 解析后的选项
  args: Record<string, unknown>     // 解析后的位置参数
  rawArgs: string[]                 // 原始位置参数
}

/** action 回调类型 */
type ICommandAction = (params: ICommandActionParams) => void | Promise<void>

/** run/parse 参数 */
interface ICommandRunParams {
  argv: string[]
  envs: Record<string, string | undefined>
  reporter?: IReporter   // 覆盖默认 reporter
}
```

---

## 方法

| 方法                                      | 说明         |
| ----------------------------------------- | ------------ |
| `.option(opt: ICommandOptionConfig)`      | 添加选项     |
| `.argument(arg: ICommandArgumentConfig)`  | 添加位置参数 |
| `.action(fn: ICommandAction)`             | 设置 action  |
| `.subcommand(name: string, cmd: Command)` | 添加子命令   |
| `.run(params: ICommandRunParams)`         | 解析 + 执行  |
| `.parse(params: ICommandRunParams)`       | 仅解析       |
| `.formatHelp()`                           | 生成帮助文本 |

---

## 树形结构

```typescript
const root = new Command({ name: 'pm', description: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', args: 'none', description: 'Verbose' })

const start = new Command({ description: 'Start a process' })
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .option({ long: 'detach', short: 'd', type: 'boolean', args: 'none', description: 'Background' })
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

---

## 选项继承

子命令强制继承祖先链上所有选项，可通过 `long` 名覆盖：

```typescript
const root = new Command({ name: 'cli', description: 'CLI' })
  .option({ long: 'logLevel', type: 'string', args: 'required', description: 'Log level' })

const sub = new Command({ description: 'Build' })
  .option({ long: 'logLevel', type: 'string', args: 'required', description: 'Build log level' })

root.subcommand('build', sub)
// cli build --log-level debug
```

详见 [option.md](./option.md)。

---

## 位置参数

位置参数**不继承**，仅在 leaf command 生效。

```typescript
interface ICommandArgumentConfig<T = unknown> {
  name: string                        // 参数名称
  description: string                 // 描述
  kind: 'required' | 'optional' | 'variadic'
  type?: 'string' | 'number'          // 值类型（默认 string）
  default?: T                         // 默认值（仅 optional）
  coerce?: (rawValue: string) => T    // 自定义转换
}
```

**约束**：

- `required` 必须在 `optional` 之前
- `variadic` 只能出现一次，且必须在最后
- `required` 不能有 `default`

```typescript
const cmd = new Command({ name: 'copy', description: 'Copy files' })
  .argument({ name: 'source', description: 'Source', kind: 'required' })
  .argument({ name: 'dest', description: 'Destination', kind: 'required' })
  .argument({ name: 'extras', description: 'Extra files', kind: 'variadic' })
```

---

## 执行流程

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          run({ argv, envs })                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. ROUTE（自顶向下）                                                   │  │
│  │    扫描 argv，按原始字符串匹配 subcommand name/alias                   │  │
│  │    → chain: Command[]（root → leaf）                                   │  │
│  │    → remaining: string[]                                               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. TOKENIZE                                                            │  │
│  │    remaining → ICommandToken[]                                         │  │
│  │    - 长选项：kebab-case → camelCase（值保持原样）                      │  │
│  │    - --no-xxx → --xxx=false                                            │  │
│  │    - `--` 分割：optionTokens + restArgs                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. RESOLVE（自底向上，两轮）                                           │  │
│  │    第一轮：每个 Command 消费自己的 option tokens                       │  │
│  │    第二轮：remaining → argTokens（非 `-` 开头）                        │  │
│  │    → consumedTokens, argTokens                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 4. PARSE（自顶向下）                                                   │  │
│  │    对 chain 中每个 Command：                                           │  │
│  │      tokens → opts（类型转换 / coerce / 校验）                         │  │
│  │      调用 option.apply(value, ctx)                                     │  │
│  │    合并 opts，解析 arguments                                           │  │
│  │    → ctx, opts, args, rawArgs                                          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 5. RUN                                                                 │  │
│  │    leaf.action({ ctx, opts, args, rawArgs })                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 阶段产物类型

```typescript
/** Route 阶段结果 */
interface ICommandRouteResult {
  chain: ICommand[]      // 命令链（root → leaf）
  remaining: string[]    // 剩余原始参数
}

/** Tokenize 阶段结果 */
interface ICommandTokenizeResult {
  optionTokens: ICommandToken[]  // 选项 tokens（`--` 之前）
  restArgs: string[]             // `--` 之后的原始参数
}

/** Resolve 阶段结果（internal） */
interface ICommandResolveResult {
  consumedTokens: Map<ICommand, ICommandToken[]>
  argTokens: ICommandToken[]
}

/** Parse 阶段结果 */
interface ICommandParseResult {
  ctx: ICommandContext
  opts: ICommandParsedOpts
  args: ICommandParsedArgs
  rawArgs: string[]
}

type ICommandParsedOpts = Record<string, unknown>
type ICommandParsedArgs = Record<string, unknown>
```

---

## shift() 方法（internal）

resolve 阶段，每个 Command 通过 `shift()` 消费自己识别的选项：

```typescript
interface ICommandShiftResult {
  consumed: ICommandToken[]   // 本命令消费的 tokens
  remaining: ICommandToken[]  // 未消费，传给 parent
}
```

**消费规则**：

1. 遍历 tokens，匹配本命令的选项
2. 按 `args` 贪婪消费：
   - `none` → 只消费选项本身
   - `required` → 消费选项 + 一个参数
   - `variadic` → 消费到 `-` 开头为止
   - `--foo=bar` → 值已内嵌，不再消费
3. 不识别的选项 → remaining
4. 非选项 token → remaining

---

## 命令路由

**命令路径必须在选项之前完全确定。**

```bash
pm start --verbose myapp    # ✅ 路由到 start
pm --verbose start myapp    # ❌ 路由停止于 pm
pm unknown --verbose        # ✅ 路由停止于 pm
```

```
for token in argv:
    if current.hasSubcommand(token):
        current = subcommand
    else:
        break
```

路由停止后，位置参数可与选项自由混合：

```bash
cli sub arg1 --opt val arg2     # ✅
cli sub -- --like-option        # --like-option 作为位置参数
```

---

## 内置选项

| 选项        | 短选项 | 说明                |
| ----------- | ------ | ------------------- |
| `--help`    | `-h`   | 显示帮助并退出      |
| `--version` | `-V`   | 显示版本（仅 root） |

用户可定义同名选项覆盖默认行为。

---

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

---

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

---

## 完整示例

```typescript
import { Command, CompletionCommand } from '@guanghechen/commander'

const pm = new Command({ name: 'pm', description: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', args: 'none', description: 'Verbose' })
  .option({ long: 'config', short: 'c', type: 'string', args: 'required', description: 'Config' })

const start = new Command({ description: 'Start a process' })
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .option({ long: 'detach', short: 'd', type: 'boolean', args: 'none', description: 'Background' })
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
