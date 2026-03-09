# Command

Command 是 CLI 应用的核心构建块，使用树形结构组织命令层级。

---

## 设计原则

1. **树形结构** — Command 是树节点，可独立运行或作为子命令挂载
2. **选项继承** — 子节点继承祖先链上所有选项，可通过 `long` 名覆盖
3. **显式依赖** — 不隐式访问 `process.argv` / `process.env`
4. **显式入口** — 使用者必须按运行时显式导入 `@guanghechen/commander/browser` 或 `@guanghechen/commander/node`

---

## 执行内核约束

以下约束定义最终执行语义基线：

1. 内部执行必须统一收敛到 `execute(params, mode)`。
2. `run()` 与 `parse()` 仅是对 `execute` 的薄封装，不允许维护独立阶段语义。
3. 阶段顺序固定为 `route -> control-scan -> control-run -> preset -> tokenize -> builtin-resolve -> resolve -> parse -> run`。
4. `mode='parse'` 必须跳过 `control-run` 与 `run` 阶段。
5. `mode='run'` 的 short-circuit 必须通过结构化终止状态表达，而不是依赖隐式分支副作用。
6. `execute` 是唯一执行真相源，`run/parse` 仅做 mode 封装与适配。

执行内核关键类型（final design）：

```typescript
type ICommandExecutionMode = 'run' | 'parse'

type ICommandExecutionTermination =
  | {
      kind: 'help'
      targetCommandPath: string
    }
  | {
      kind: 'version'
      targetCommandPath: string
      version: string
    }

type IExecutionOutcome =
  | {
      kind: 'parsed'
      parseResult: ICommandParseResult
    }
  | {
      kind: 'terminated'
      termination: ICommandExecutionTermination
    }
  | {
      kind: 'failed'
      error: CommanderError
    }
```

说明：执行帧、阶段中间产物、诊断构建器与来源账本均属实现细节；规范仅约束外部可观测语义（阶段顺序、输入输出、错误语义），不约束内部类型形状。

### 实现分层（non-normative，非规范）

以下分层仅作当前实现参考，不构成规范约束；在外部语义不变时可重组文件布局。

1. `command-kernel`：编排 9 阶段执行骨架与 mode 分流（`run/parse`）。
2. `diagnostics-engine`：统一生成 `error/hint` 结构，保证 issue 不变量。
3. `context-adapter`：负责 kernel 产物与 `ICommandContext` 的对齐与冻结。
4. `help renderer`：负责 `help data` 组装与 plain/terminal 渲染（含 display-width 对齐与 `--color` 决议）。
5. `preset profile parser`：负责 preset manifest/profile/variant 解析与 preset option token 约束校验。

边界说明：规范只要求阶段行为与错误语义一致，不要求保留上述模块命名或目录层级。

---

## 运行时入口契约

1. 包导出仅包含 `./browser` 与 `./node` 两个入口，根入口 `.` 不对外导出。
2. `@guanghechen/commander/browser` 提供 browser-safe API（不导出 completion 相关类，也不导出 internal 保留项 `devmodeOption` / `logLevelOption`）。
3. `@guanghechen/commander/node` 在 browser-safe API 基础上额外导出 `CompletionCommand`、`BashCompletion`、`FishCompletion`、`PwshCompletion`；同样不导出 `devmodeOption` / `logLevelOption`。
4. `Command` 支持通过 `runtime` 显式注入运行时能力；若未注入，则使用入口设置的默认 runtime。

---

## 类型定义

```typescript
/** Command 实例接口 */
interface ICommand {
  readonly name: string | undefined
  readonly version: string | undefined
  readonly builtin: ICommandConfig['builtin'] | undefined
  readonly preset: ICommandPresetConfig | undefined
  readonly description: string
  readonly parent: ICommand | undefined
  readonly options: ICommandOptionConfig[]
  readonly arguments: ICommandArgumentConfig[]
  readonly examples: ICommandExample[]
  readonly subcommands: Map<string, ICommand>
}

interface ICommandExample {
  title: string
  usage: string
  desc: string
}

interface ICommandPresetConfig {
  file?: string     // 可选 preset profile 文件（同 `<file>` 判定）
  profile?: string  // 可选 profile selector（同 `<profile[:variant]>` 判定）
}

type ICommandPresetProfileOptionValue =
  | boolean
  | string
  | number
  | ReadonlyArray<string | number>

interface ICommandPresetProfileItem {
  envFile?: string
  envs?: Record<string, string>
  opts?: Record<string, ICommandPresetProfileOptionValue>
  defaultVariant?: string
  variants?: Record<string, {
    envFile?: string
    envs?: Record<string, string>
    opts?: Record<string, ICommandPresetProfileOptionValue>
  }>
}

interface ICommandPresetProfileManifest {
  version: 1
  defaults?: { profile?: string } // profile selector: <profile> or <profile>:<variant>
  profiles: Record<string, ICommandPresetProfileItem>
}

interface ICommandRuntimeStats {
  isDirectory(): boolean
}

interface ICommandRuntime {
  cwd(): string
  isAbsolute(filepath: string): boolean
  resolve(...paths: string[]): string
  readFile(filepath: string): Promise<string>
  stat(filepath: string): Promise<ICommandRuntimeStats>
}

/** Command 构造配置 */
interface ICommandConfig {
  name?: string           // 命令名称（仅 root 需要）
  desc: string            // 命令描述
  version?: string        // 版本号（用于 --version）
  builtin?: boolean | {
    option?: boolean | {
      version?: boolean
      color?: boolean
      devmode?: boolean
      logLevel?: boolean
      silent?: boolean
      logDate?: boolean
      logColorful?: boolean
    }
  }
  preset?: ICommandPresetConfig
  reporter?: IReporter    // Reporter 实例（来自 @guanghechen/reporter）
  runtime?: ICommandRuntime // 运行时适配器（默认由入口设置）
}

/** 预置输入来源快照（用于调试/追踪） */
interface ICommandInputSources {
  preset: {
    state: 'skipped' | 'none' | 'applied'
    argv: string[]
    envs: Record<string, string> // 来自 preset profile（envFile + envs）合并结果，不含 undefined
    meta?: {
      applied: boolean
      file?: string
      profile?: string
      variant?: string
    }
  }
  user: {
    cmds: string[] // command chain（按用户输入记录，允许 name/alias）
    argv: string[] // PRESET 路径下为移除 command chain/控制项/`--preset-*` 后的 clean argv；short-circuit 路径下为 controlTailArgv
    envs: Record<string, string | undefined> // run/parse 入参 envs 快照
  }
}

interface ICommandControls {
  help: boolean
  version: boolean
}

/** 执行上下文 */
interface ICommandContext {
  cmd: ICommand                              // 当前命令节点
  chain: ICommand[]                          // 命令链（root → leaf）
  envs: Record<string, string | undefined>   // effective 环境变量（常规为 preset + user；run short-circuit 路径仅 user）
  controls: ICommandControls                 // 控制语义命中结果（help/version）
  sources: ICommandInputSources              // 输入来源快照（preset/user）
  reporter: IReporter                        // Reporter 实例
}

/** action 回调参数 */
interface ICommandActionParams {
  ctx: ICommandContext              // 执行上下文
  builtin: {                        // 当前 leaf 的内建选项快照
    devmode: boolean
    color?: boolean
    logLevel?: string
    silent?: boolean
    logDate?: boolean
    logColorful?: boolean
  }
  opts: Record<string, unknown>     // 解析后的选项（仅 leaf 本地声明项）
  args: Record<string, unknown>     // 解析后的位置参数（仅 leaf 本地声明项）
  rawArgs: string[]                 // 原始位置参数
}

/** parse 返回结果 */
interface ICommandParseResult {
  ctx: ICommandContext
  builtin: ICommandActionParams['builtin']
  opts: Record<string, unknown>
  args: Record<string, unknown>
  rawArgs: string[]
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

### 上下文约定

1. 在 PRESET 阶段执行后，`ctx.envs` 为 effective 输入（`preset + user` 合并）。
2. `ctx` 顶层不暴露 `ctx.argv/ctx.rawArgs`；调试输入请使用 `ctx.sources.*.argv` 快照；位置参数通过 `action` 参数 `args/rawArgs` 暴露。
3. `action` 的 `builtin/opts/args` 当前为运行时对象（`Record<string, unknown>`）；其中 `opts/args` 字段集合由 leaf 本地声明决定，`builtin` 仅暴露内建选项快照。
4. `ctx.controls` 仅记录是否命中控制语义（`help/version`），默认 `{ help:false, version:false }`。
5. `ctx.chain` 是 route 阶段得到的命令链（`root → leaf`）。
6. `ctx.sources.user.cmds` 是 route 结果的命令 token 快照（保留用户输入的 name/alias）。
7. 在 PRESET 阶段执行路径下，`ctx.sources.user.argv` 是从用户入参 `argv` 中移除 command chain、控制项与 preset 指令后得到的 clean argv。
8. `ctx.sources.user.envs` 是 `run/parse` 入参 `envs` 的快照。
9. `ctx.sources.preset.argv` 是分词后的 token 序列，不是原始文件文本。
10. `ctx.sources.preset.envs` 是 `@guanghechen/env.parse` 的结果。
11. `ctx.sources.preset.state` 表示 PRESET 路径状态：`skipped`（run/control-run 提前中断，未执行 PRESET）、`none`（执行 PRESET 但未采用 profile）、`applied`（执行 PRESET 且采用 profile）。
12. 仅当 `ctx.sources.preset.state==='applied'` 时，`ctx.sources.preset.meta?.applied===true`。
13. `ctx.sources.preset.meta?.file/profile/variant`（若存在）与 PRESET 决议结果一致。
14. `ctx.sources` 是 PRESET 阶段的来源快照，同时也是构建 effective 输入的来源。
15. 若 `run()` 在 `control-run` 命中 short-circuit，则 PRESET 不执行：`ctx.sources.preset.state='skipped'`，`ctx.sources.preset` 保持空快照（`argv=[]`, `envs={}`, `meta` 为空），`ctx.sources.user.argv` 固定为 CONTROL SCAN 产出的 `controlTailArgv`（不做 preset 指令剥离）。
16. effective 输入一旦生成（`effectiveTailArgv` / `ctx.envs`），后续阶段只消费 effective 输入，不再回写 `ctx.sources`。
17. `ctx.sources` 应作为只读快照暴露给 `action`，避免运行期被意外改写。
18. `params.builtin.devmode` 始终暴露为 `boolean`（默认 `false`）。

补充：`state='skipped'` 主要服务于流程可观测性与测试断言；`run()` 仍保持 `Promise<void>`，不引入额外返回协议。

## 内置功能配置

`builtin` 用于控制“可配置的内置 options”开关。

| 配置值                     | 语义                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `builtin: undefined`       | 默认行为：开启全部可配置内置 options                                                     |
| `builtin: true`            | 开启全部可配置内置 options                                                               |
| `builtin: false`           | 关闭全部可配置内置 options                                                               |
| `builtin: { option: ... }` | 覆盖可配置内置 options 配置                                                              |

`option` 字段支持 `boolean` 或细粒度对象。

| 字段                 | `true` 语义               | `false` 语义              |
| -------------------- | ------------------------- | ------------------------- |
| `builtin.option`     | 开启全部可配置内置 option | 关闭全部可配置内置 option |
| `option.version`     | 开启内置 `--version`      | 关闭内置 `--version`      |
| `option.color`       | 开启内置 `--color`        | 关闭内置 `--color`        |
| `option.devmode`     | 开启内置 `--devmode`      | 关闭内置 `--devmode`      |
| `option.logLevel`    | 开启内置 `--log-level`    | 关闭内置 `--log-level`    |
| `option.silent`      | 开启内置 `--silent`       | 关闭内置 `--silent`       |
| `option.logDate`     | 开启内置 `--log-date`     | 关闭内置 `--log-date`     |
| `option.logColorful` | 开启内置 `--log-colorful` | 关闭内置 `--log-colorful` |

细粒度对象示例：

```typescript
const cmd = new Command({
  name: 'cli',
  desc: 'CLI',
  builtin: {
    option: {
      devmode: true,
      logLevel: true,
      silent: true,
      logDate: false,
      logColorful: false,
    },
  },
})
```

固定内建语义（不受 `builtin` 配置影响）：

1. `--help` 始终可用。
2. `help` 子命令语法始终可用。

### 内建 version 支持判定

`--help` 与 `help` 子命令语法为固定内建能力（始终可用）；仅 `--version` 需要判定是否可用。

```typescript
function isBuiltinOptionEnabled(cmd: ICommand): boolean {
  // 仅控制可配置的内置 options（version/color/log*）
  if (cmd.builtin === false) return false
  if (typeof cmd.builtin === 'object' && cmd.builtin.option === false) return false
  return true
}

function isBuiltinVersionEnabled(cmd: ICommand): boolean {
  if (!isBuiltinOptionEnabled(cmd)) return false
  if (
    typeof cmd.builtin === 'object' &&
    typeof cmd.builtin.option === 'object' &&
    cmd.builtin.option.version === false
  ) {
    return false
  }
  return true
}

function supportsBuiltinVersion(cmd: ICommand): boolean {
  // 当前节点配置了 version 且内建 version 已开启
  return isBuiltinVersionEnabled(cmd) && Boolean(cmd.version)
}
```

规则说明：

1. CONTROL SCAN 在 `run()` 与 `parse()` 都执行。
2. `--help` / `help` 始终可识别；`--version` 仅在 `supportsBuiltinVersion(leaf)===true` 时可识别，否则按普通 token 流入后续解析。
3. `control-run` 仅在 `run()` 中执行，并按 `help > version` 优先级 short-circuit。
4. `--version` 是否可用仅由当前 leaf 的配置决定（与是否 root 无关）。
5. 以上判定与 route/preset 无关，只依赖 command 自身配置与节点位置。

代表性场景：

1. `builtin=false` 或 `builtin.option=false`：`supportsBuiltinVersion=false`。
2. `builtin.option.version=false`：即使 command 配置了 `version`，`supportsBuiltinVersion=false`。
3. 其余情况下，仅当当前 leaf 配置了 `version` 时，`supportsBuiltinVersion=true`。

注：`-h/-v/-V` 不属于框架内建判定范围；框架内建仅处理 `--help` / `--version`。

---

## 方法

| 方法                                      | 说明         |
| ----------------------------------------- | ------------ |
| `.option(opt: ICommandOptionConfig)`      | 添加选项     |
| `.argument(arg: ICommandArgumentConfig)`  | 添加位置参数 |
| `.action(fn: ICommandAction)`             | 设置 action  |
| `.example(title, usage, desc)`            | 添加示例     |
| `.subcommand(name: string, cmd: Command)` | 添加子命令   |
| `.run(params: ICommandRunParams)`         | 解析 + 执行  |
| `.parse(params: ICommandRunParams)`       | 仅解析       |
| `.formatHelp()`                           | 生成帮助文本 |

`run/parse` 契约：

1. `.run(params)` 返回 `Promise<void>`。
2. `.parse(params)` 返回 `Promise<ICommandParseResult>`。
3. `.parse()` 在解析错误（格式错误、校验失败、unknown option 等）时抛错；`.run()` 作为 CLI 入口按 Exit Code 语义处理错误。
4. `CONTROL SCAN` 在 `.run()` 与 `.parse()` 都执行：识别控制项并写入 `ctx.controls`。
5. 仅 `.run()` 执行控制项 short-circuit；`.parse()` 不生成 termination。
6. `--help` / `help` / `--version` 属于控制语义，不属于 `opts` 输出字段。
7. `opts/args` 仅描述当前 command 本地声明项（不包含祖先继承项）。
8. `builtin` 表示当前 leaf 的内建选项快照，不属于用户 option 声明集合。
9. Exit Code 语义仅适用于 CLI 入口层（`run()`）；`parse()` 仅返回结果或抛错，不定义进程退出码。
10. `parse()` 中即使命中控制语义，仍继续执行 PRESET/TOKENIZE/BUILTIN RESOLVE/RESOLVE/PARSE 与校验流程（不 short-circuit）。
11. `.run()` / `.parse()` 的阶段执行语义必须由同一 `execute` 内核提供，不允许重复维护两套阶段实现。
12. `.run()` 的控制项命中结果应在内核中体现为 `termination`，随后由 CLI 入口决定渲染与退出行为。
13. `termination` 的内部数据结构与字段语义（如 `targetCommandPath`）以本文“执行内核关键类型”定义为准。
14. `run()` 的 Exit Code 必须由 CLI adapter 按固定映射执行：`outcome.kind in {'parsed','terminated'}` 为 `0`；`outcome.kind='failed' && error.kind==='ActionFailed'` 为 `1`；其余 `failed` 为 `2`。

运行时字段语义（仅 leaf 本地声明）示例：

```typescript
const root = new Command({ name: 'app', desc: 'App' })
  .option({ long: 'verbose', type: 'boolean', args: 'none', desc: 'Verbose' })

const deploy = new Command({ desc: 'Deploy' })
  .option({ long: 'force', type: 'boolean', args: 'none', desc: 'Force deploy' })
  .argument({ name: 'target', desc: 'Deploy target', kind: 'required', type: 'string' })
  .action(({ builtin, opts, args }) => {
    builtin['devmode'] // 始终存在，boolean
    opts['force']      // 运行时存在（本地声明）
    args['target']     // 运行时存在（本地声明）
    // opts['verbose'] 不会出现在 leaf 对外 opts 中
  })

root.subcommand('deploy', deploy)
```

`example(title, usage, desc)` 规则：

- 仅支持 fluent API，不支持构造参数注入
- 每次调用按顺序追加，不去重
- `usage` 是相对当前 command path 的片段，渲染时自动补齐前缀
- examples 不继承，只显示当前 command 自己注册的条目

`subcommand(name, cmd)` 规则：

- `name='help'` 仍为保留名，禁止注册。
- 同一父 command 下，子命令命名空间（`primary name + aliases`）必须全局唯一。
- 若 `name` 已被其他子命令占用（无论 primary name 还是 alias），构建期抛 `ConfigurationError`。
- 对同一 `cmd` 重复注册同一 `name` 视为幂等操作（不重复追加 alias）。

---

## 树形结构

```typescript
const root = new Command({ name: 'pm', desc: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', args: 'none', desc: 'Verbose' })

const start = new Command({ desc: 'Start a process' })
  .argument({ name: 'name', desc: 'Process name', kind: 'required', type: 'string' })
  .option({ long: 'detach', short: 'd', type: 'boolean', args: 'none', desc: 'Background' })
  .action(async ({ opts, args }) => {
    console.log(`Starting ${args.name}, detach: ${opts.detach}`)
  })

root.subcommand('start', start).subcommand('s', start)  // s 是 start 的别名
root.subcommand('stop', new Command({ desc: 'Stop' }))

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
const root = new Command({ name: 'cli', desc: 'CLI' })
  .option({ long: 'region', type: 'string', args: 'required', desc: 'Region' })

const sub = new Command({ desc: 'Build' })
  .option({ long: 'region', type: 'string', args: 'required', desc: 'Build region' })

root.subcommand('build', sub)
// cli build --region ap-east-1
```

补充约定：继承项会参与解析与 `apply`，但 `action/parse` 暴露的 `opts` 仅包含 leaf command 本地声明项。

详见 [option.md](./option.md)。

---

## 位置参数

位置参数**不继承**，仅在 leaf command 生效。

```typescript
type ICommandArgumentType = 'string' | 'choice'
type ICommandArgumentChoice = string

interface ICommandArgumentConfig<T = unknown> {
  name: string                          // 参数名称
  desc: string                          // 描述
  kind: 'required' | 'optional' | 'variadic' | 'some'
  type: ICommandArgumentType            // 值类型（必填）
  choices?: readonly ICommandArgumentChoice[] // 仅 type='choice' 可用
  default?: T                           // 默认值（仅 optional）
  coerce?: (rawValue: string) => T      // 自定义转换（优先于内置 type 转换）
}
```

`kind` 语义：

| kind       | 基数约束  | help signature | 输出值形态         |
| ---------- | --------- | -------------- | ------------------ |
| `required` | 恰好 1 个 | `<name>`       | 单值               |
| `optional` | 0 或 1 个 | `[name]`       | 单值或 `undefined` |
| `variadic` | 0 或更多  | `[name...]`    | 数组（可空）       |
| `some`     | 1 或更多  | `<name...>`    | 数组（至少 1 项）  |

**约束**：

- `required` 必须在 `optional` / `variadic` / `some` 之前
- `variadic` 与 `some` 只能出现一次（两者合计最多一个），且必须在最后
- `required` 不能有 `default`
- `kind` 为必填，且只能是 `required | optional | variadic | some`
- `type` 为必填，不允许省略
- `type='string'` 时，不允许提供 `choices`
- `type='choice'` 时，`choices` 必填且必须为非空 `string[]`
- `default` 仅允许用于 `optional`，且必须通过 `type + choices` 校验
- `default` 校验不经过 `coerce`

上述约束违例均属于构建期 `ConfigurationError`。

`default` 校验细则：

- `type='string'`：`default` 必须是 `string`
- `type='choice'`：`default` 必须是 `string`，且命中 `choices`

**解析与校验顺序**（单值）：

1. 若存在 `coerce`，先执行 `coerce(raw)`。
2. 若不存在 `coerce`，执行内置 `type` 转换：
   - `string`: 保留原始字符串。
   - `choice`: 保留原始字符串。
3. 若 `type='choice'`，执行 choices 校验；不在集合内时报 `InvalidChoice`。

当存在 `coerce` 时：

- `coerce` 返回值必须与 `type` 对齐：
  - `type='string'`：返回值必须是 `string`
  - `type='choice'`：返回值必须是 `string`
- 不对齐属于 parse 阶段错误，抛 `InvalidType`。
- `type='choice'` 时，`choices` 校验对象为 `coerce` 返回值。

`variadic` 与 `some` 参数在 parse 阶段按元素逐项执行上述顺序，并逐项做 choices 校验。

额外约束：

- `kind='variadic'` 允许解析为空数组 `[]`。
- `kind='some'` 解析结果必须至少包含 1 项；否则报 `MissingRequiredArgument`。

```typescript
const cmd = new Command({ name: 'copy', desc: 'Copy files' })
  .argument({ name: 'source', desc: 'Source', kind: 'required', type: 'string' })
  .argument({
    name: 'mode',
    desc: 'Copy mode',
    kind: 'optional',
    type: 'choice',
    default: 'safe',
    choices: ['safe', 'force'],
  })
  .argument({
    name: 'extras',
    desc: 'Extra files',
    kind: 'some',
    type: 'string',
  })
```

---

## 执行流程

以下流程图描述 `execute(..., 'run')` 的标准 pipeline。

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          run({ argv, envs })                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 0. ROUTE（命令链路由）                                                 │  │
│  │    基于 user.argv 匹配 command chain（name/alias）                     │  │
│  │    route 阶段不改写 argv；仅产出 chain 与 user tail argv               │  │
│  │    产物：chain 与 user tail argv                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. CONTROL SCAN（run/parse）                                           │  │
│  │    在 user tail（`--` 之前）识别控制语义                               │  │
│  │    - `--help` / `--version`：在 tail 中按 token 扫描                   │  │
│  │    - `help` / `help <child>`：仅当 tail 首 token 为 `help`             │  │
│  │    写入 ctx.controls，并移除控制语义 token 得到 controlTailArgv        │  │
│  │    同时命中时：help 优先于 version                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. control-run（仅 run）                                               │  │
│  │    若 ctx.controls.help / ctx.controls.version 命中则 short-circuit    │  │
│  │    仅写入 termination 结构化状态，不进入 PRESET/校验/action            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. PRESET（输入预置）                                                  │  │
│  │    仅在 `--` 之前扫描 --preset-file/--preset-profile                   │  │
│  │    若命中 --preset-file：解析 profile manifest（JSON）                 │  │
│  │    profile 决议：CLI > command.preset > manifest.defaults              │  │
│  │    注入 profile + variant 的 opts/envFile/envs                         │  │
│  │    从 controlTailArgv 移除这些指令，写入 sources.user.argv（clean）    │  │
│  │    effectiveTailArgv = [...sources.preset.argv, ...sources.user.argv]  │  │
│  │    ctx.envs = { ...sources.user.envs, ...sources.preset.envs }         │  │
│  │    挂载 sources 快照到 ctx.sources                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 4. TOKENIZE                                                            │  │
│  │    effectiveTailArgv → ICommandToken[]                                 │  │
│  │    - 长选项：kebab-case → camelCase（值保持原样）                      │  │
│  │    - --no-xxx → --xxx=false                                            │  │
│  │    - `--` 分割：optionTokens + restArgs                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 5. BUILTIN RESOLVE                                                     │  │
│  │    解析当前 chain 的内建 option 注入策略                               │  │
│  │    产物：optionPolicyMap                                               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 6. RESOLVE（自底向上，两轮）                                           │  │
│  │    第一轮：每个 Command 消费自己的 option tokens                       │  │
│  │    第二轮：remaining → argTokens（非 `-` 开头）                        │  │
│  │    → consumedTokens, argTokens                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 7. PARSE（自顶向下）                                                   │  │
│  │    对 chain 中每个 Command：                                           │  │
│  │      tokens → opts（类型转换 / coerce / 校验）                         │  │
│  │      调用 option.apply(value, ctx)                                     │  │
│  │    生成 leaf builtin/opts/args（opts/args 不包含祖先声明项）           │  │
│  │    → ctx, builtin, opts, args, rawArgs                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                   ↓                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 8. RUN（仅 run）                                                       │  │
│  │    leaf.action({ ctx, builtin, opts, args, rawArgs })                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

`execute(..., 'parse')` 执行阶段为：`ROUTE -> CONTROL SCAN -> PRESET -> TOKENIZE -> BUILTIN RESOLVE -> RESOLVE -> PARSE`（不执行 `control-run` 与 `RUN`，命中控制项也不会提前中断）。

`run()` / `parse()` 都必须委托到同一执行内核，不允许维护双份流程代码。

---

## 阶段产物类型

阶段中间产物属于实现细节。规范只约束各阶段的输入输出语义与顺序，不要求固定的数据结构命名与字段布局。

### PRESET 规则

1. `--preset-file=<file>` / `--preset-file <file>` 与 `--preset-profile=<profile[:variant]>` / `--preset-profile <profile[:variant]>` 语义等价（分别支持两种 token 形式）。
2. 仅处理 `--` 之前的 preset 指令；`--` 之后的 `--preset-*` 按普通参数处理。
3. route 阶段产物应先写入 `ctx.sources.user.cmds`（保留 name/alias）与 user tail argv。
4. 扫描到的 preset 指令会从 `controlTailArgv` 中移除，移除后的数组写入 `ctx.sources.user.argv`。
5. 若 CLI 未声明 `--preset-file` / `--preset-profile`，可回退 `command.preset.file` / `command.preset.profile`（二者独立决议，均在 `ctx.chain` 上按 `leaf -> ... -> root` 首命中）。
6. CLI 显式指令优先级高于 command preset 默认：`--preset-file` 覆盖 `command.preset.file`，`--preset-profile` 覆盖 `command.preset.profile`。
7. `--preset-profile` 不能脱离 `--preset-file` 单独使用；`command.preset.profile` 也不能脱离 `command.preset.file`（除非 CLI 提供了 `--preset-file`）。
8. profile selector 决议顺序：`--preset-profile` > `command.preset.profile` > `manifest.defaults.profile`；若都缺失则报 `ConfigurationError`。
9. selector 支持 `<profile>` 与 `<profile>:<variant>`；若未显式给出 variant，则回退 `profile.defaultVariant`。
10. 对选中的 profile/variant，`envFile`（若存在）按 UTF-8 读取并由 `@guanghechen/env.parse` 解析；相对路径按 `preset-file` 所在目录解析。
11. `profile.opts` 与 `profile.envs` 在 variant 命中时按 `base + variant` 覆盖合并。
12. `profile.envs` 覆盖 profile `envFile` 同名键；`variant.envFile/envs` 再覆盖 profile 侧结果。
13. `profile.opts`（若存在）转为 option token 片段并拼接进 `ctx.sources.preset.argv`。
14. 当被采用时，`--preset-file`、`command.preset.file` 与选中 profile/variant 的 `envFile` 必须指向存在且可读的文件路径。
15. `<profile>` / `<variant>` 参数必须是合法名称（实现约束：`[A-Za-z0-9][A-Za-z0-9._-]*`）。
16. 合并顺序固定：`effectiveTailArgv = [...ctx.sources.preset.argv, ...ctx.sources.user.argv]`。
17. 合并顺序固定：`ctx.envs = { ...ctx.sources.user.envs, ...ctx.sources.preset.envs }`。
18. 若 `control-run` 阶段已命中 short-circuit，则 PRESET 阶段不会执行。
19. profile 生成的 option token 中不允许出现 `--help` / `help` / `--version`；命中即报 `ConfigurationError` 并终止。
20. profile 生成的 option token 中不允许出现 `--preset-file` / `--preset-profile`；命中即报 `ConfigurationError` 并终止。
21. 显式声明且被采用的 preset 文件（`--preset-file` / `command.preset.file` / 选中 profile/variant 的 `envFile`）读取失败或内容解析失败，应立即报错并终止。
22. `--preset-root` 已移除，不再属于预置指令。
23. PRESET 阶段仅执行词法约束（如 `--`、控制项、preset 指令与裸 token 起始校验），不执行 option 语义判定。
24. profile `opts` 的 option 语义合法性在 `BUILTIN RESOLVE -> RESOLVE -> PARSE` 阶段统一校验。
25. 约束细节见 [option.md](./option.md)“强制约束”与“错误语义”。
26. PRESET 阶段执行后，`ctx.sources.preset.state` 必须为 `none` 或 `applied`；`run()` 的 `control-run` short-circuit 路径必须写入 `state='skipped'`。

### CONTROL SCAN 规则

1. 在 `run()` 与 `parse()` 中都执行。
2. 检查范围仅限 user tail 且位于 `--` 之前。
3. `--help` 在 tail（`--` 之前）中按 token 扫描，命中时设置 `ctx.controls.help = true`。
4. `help` / `help <child>` 仅在 tail 首 token 为 `help` 时识别，命中时设置 `ctx.controls.help = true`。
5. `--version` 在 tail（`--` 之前）中按 token 扫描；仅当 `supportsBuiltinVersion(leaf)===true` 时可识别，命中时设置 `ctx.controls.version = true`。
6. 当 `supportsBuiltinVersion(leaf)===false` 时，`--version` 不作为控制语义处理并保留在 tail；后续按普通 option 解析（若无匹配则报 `UnknownOption`）。
7. 命中控制语义的 token 会从 tail 输入中移除，不再进入 PRESET/TOKENIZE/BUILTIN RESOLVE/RESOLVE/PARSE。
8. `help <child>` 为单跳语法：最多只消费 `help` 与紧随其后的一个 `<child>` token；`<child>` 记录为内部 `helpTarget`（不暴露到 `ctx`）。
9. `--` 之后出现的 `help` / `--help` / `--version` 不属于控制语义，按普通参数处理。
10. 保留名规则见“内置选项”章节；命中保留名时构建期报 `ConfigurationError`。
11. 控制语义不属于 `opts` 输出字段。
12. 在 `parse()` 中，CONTROL SCAN 之后的剩余 token 仍按常规进入后续阶段并执行校验（可能正常返回，也可能抛错）。

### `control-run` 规则

1. 仅在 `run()` 中执行，且发生在 PRESET 之前。
2. 若 `ctx.controls.help === true`，则写入 `termination.kind='help'`（目标 command 通过 `targetCommandPath` 表达）并 short-circuit。
3. 否则，若 `ctx.controls.version === true`，则写入 `termination.kind='version'`（含版本文本）并 short-circuit。
4. 若同时命中，按优先级 `help > version`。
5. 命中 short-circuit 后不进入 PRESET/校验/action。
6. 该 short-circuit 优先级高于 validation。
7. 命中 short-circuit 的路径不读取 preset 文件；`ctx.envs` 保持 user envs 快照语义。
8. 终止态的渲染与退出码决策由 CLI 入口适配层负责，执行内核不直接输出。

---

## Resolve 实现提示（非规范）

实现可采用 `shift` 风格或等价算法。无论具体实现如何，都必须满足本文在 `RESOLVE/PARSE` 章节定义的外部行为：

1. option 消费遵循各 `args` 模式语义。
2. 未被识别的 option 在 resolve 阶段进入 unknown option 处理。
3. `optional` 的落值语义保持一致（裸 option 为 `undefined`，`--long=` 为空字符串）。

---

## 命令路由

**命令路径必须在选项之前完全确定。**

```bash
pm start --verbose myapp    # ✅ 路由到 start
pm --verbose start myapp    # ❌ 路由停止于 pm
pm unknown --verbose        # ✅ 路由停止于 pm
pm help start               # ✅ route 停止于 pm（tail: ["help", "start"]）
pm help unknown             # ✅ route 停止于 pm（tail: ["help", "unknown"]）
```

```
for token in user.argv:
    if token starts with '-':
        break
    if current.hasSubcommand(token):
        current = subcommand
    else:
        break
```

未知子命令与意外参数语义：

1. route 保持“遇到不命中子命令 token 即停止”的行为，不在 route 阶段抛错。
2. 若 route 停止后的 leaf 存在子命令，且 tail 首 token 为裸 token（非 `help` / 非 option），parse 阶段抛 `UnknownSubcommand`。
3. `UnknownSubcommand` 与 `UnexpectedArgument` 冲突时，优先级固定为 `UnknownSubcommand > UnexpectedArgument`。
4. `UnexpectedArgument` 仅在未命中 `UnknownSubcommand` 且 leaf 未声明任何位置参数时触发。
5. `TooManyArguments` 仅用于“已声明位置参数但传入数量超上限”的场景。
6. 当抛出 `UnknownSubcommand` 且当前 leaf 同时不接受位置参数时，应追加 `hint issue`：`reason.code='command_does_not_accept_positional_arguments'`；默认渲染文本可为 `Hint: command "<path>" does not accept positional arguments.`。
7. 当抛出 `UnknownSubcommand` 且存在唯一高置信候选子命令时，应追加 `hint issue`：`reason.code='did_you_mean_subcommand'`；默认渲染文本可为 `Hint: did you mean "<candidate>"?`。
8. 候选提示判定规则：
   - 候选集合仅包含当前 leaf 的直接子命令 `name`（不包含 aliases）；
   - 候选排序策略由实现决定（可使用编辑距离、前缀匹配或其他等价方法）；
   - 仅当可确定唯一且高置信候选时，才输出 `did-you-mean` hint；
   - 若无法确定唯一高置信候选，则不输出该 hint。

判例：

```bash
cli build watc     # => UnknownSubcommand（可附带 did-you-mean hint）
cli test foo       # => UnexpectedArgument（test 无子命令且不接收位置参数）
cli build foo      # => UnknownSubcommand（即使 build 不接收位置参数，仍优先 UnknownSubcommand）
```

`help` 子命令语义（CONTROL SCAN / `control-run` 阶段处理）：

1. route 仅负责产出 `ctx.sources.user.cmds` 与 user tail argv；不处理 help 语义。
2. `help` 语法在所有 command 节点均可用（自动内建）。
3. 在 `run()` 中，`help <child>`：若 `<child>` 是当前 leaf 的合法子命令（name/alias），则生成 `termination.kind='help'` 且 `targetCommandPath` 为该子命令路径。
4. 在 `run()` 中，`help` 或 `help <unknown>`：生成 `termination.kind='help'` 且 `targetCommandPath` 为当前 leaf 路径。
5. 在 `run()` 中命中 help 语法后 short-circuit；后续 token 不再参与解析。
6. 在 `parse()` 中命中 help 语法仅写入 `ctx.controls.help = true`，不生成 termination。
7. `help <child>` 为单跳语法；`help` 之后仅解析一个 `<child>` token 作为目标子命令候选。

路由停止后，位置参数可与选项自由混合：

```bash
cli sub arg1 --opt val arg2     # ✅
cli sub -- --like-option        # --like-option 作为位置参数
```

---

## 内置选项

| 选项                                   | 短选项 | 说明                                                             |
| -------------------------------------- | ------ | ---------------------------------------------------------------- |
| `--color` / `--no-color`               | -      | 控制 help 彩色渲染                                               |
| `--help`                               | -      | 显示帮助并退出                                                   |
| `--version`                            | -      | 显示版本（当前 leaf 的 `version` 已配置且 builtin version 启用） |
| `--devmode`                            | -      | 开发模式；未显式传入 `--log-level` 时默认提升为 `debug`         |
| `--log-level`                          | -      | 设置日志级别                                                     |
| `--silent`                             | -      | 静默模式（仅 error）                                             |
| `--log-date` / `--no-log-date`         | -      | 控制日志时间戳                                                   |
| `--log-colorful` / `--no-log-colorful` | -      | 控制彩色输出                                                     |

除 `help/version/devmode/logLevel` 保留项外，用户可通过 `.option()` 显式声明同名选项覆盖框架自动注入项；覆盖范围包括解析、默认值、help 展示与 `apply` 行为。

`builtin` 开关仅控制框架“自动注入”的内建选项；`devmode` 与 `logLevel` 为保留名，不支持用户同名覆盖。

`help/version/devmode/logLevel` 保留项约束：

1. CONTROL SCAN 仅识别内建 `--help` / `help` / `--version`（不提供 short alias）。
2. 用户在 `.option()` 中自定义 `long: 'help'` / `long: 'version'` / `long: 'devmode'` / `long: 'logLevel'` 属于非法配置，构建期报错 `ConfigurationError`。
3. `-h/-v/-V` 在框架内不具备内建语义；是否生效完全取决于用户自定义 short 选项。
4. `params.builtin.devmode` 始终存在，值域固定为 `true | false`。

`--color` 仅影响 help 的终端渲染；
`--log-colorful` 影响 `Reporter` 的日志输出。

当 `NO_COLOR` 环境变量存在时，help 渲染默认使用 `--no-color`；
显式传入 `--color` 优先级更高。

---

## help 子命令

`help` 子命令语法为自动内建，无需显式配置。

```bash
cli help           # 显示 cli 帮助
cli help init      # 显示 init 子命令帮助
cli repo help      # 显示 repo 子命令帮助
cli repo help sync # 显示 repo sync 子命令帮助
```

语义规则：

1. `help` 是语法糖，不是实际注册的子命令。
2. `help` 在所有 command 节点均可用，不可关闭。
3. route 阶段不改写 `help` 为 `--help`。
4. 在 `run()` 中，对任意节点 `<node>`，`<node> help` 生成 `help termination`，`targetCommandPath` 为 `<node>` 路径。
5. 在 `run()` 中，对任意节点 `<node>`，`<node> help <child>` 在 `<child>` 合法时 `targetCommandPath` 为 `<child>` 路径，否则回退为 `<node>` 路径。
6. 在 `parse()` 中命中 help 语法仅写入 `ctx.controls.help = true`，不生成 termination。
7. `help <child>` 为单跳语法，仅消费一个 `<child>`；额外 token 在 `run()` 下被 short-circuit 忽略，在 `parse()` 下进入后续解析流程。

禁止注册名为 `help`（或 alias 为 `help`）的真实子命令，构建期报错 `ConfigurationError`。

---

## 帮助输出格式

help 输出 section 顺序：`Usage` → `Arguments` → `Options` → `Commands` → `Examples`。

`Options` section 渲染规则：

1. 仅展示正向 option signature（例如 `--color`），不额外展示 `--no-*` 行。
2. 排序规则为：`--help` 固定第一，`--version` 固定第二（若可用），随后 `required===true` 的 option，再是其他 option。
3. `required` 与其他两组内部均按 long name（kebab-case）字母序升序。

`Commands` section 渲染规则：

1. 当存在子命令时，固定先展示 `help` 行。
2. 其余子命令按名称字母序升序展示。

`Arguments` section 渲染规则：

1. 仅当当前 command 声明了至少一个位置参数时展示。
2. `signature` 按 `kind` 渲染：`required => <name>`、`optional => [name]`、`variadic => [name...]`、`some => <name...>`。
3. 每行包含 `signature + desc`，并按需追加元信息：
   - `[type: ...]`（始终展示）
   - `[default: ...]`（仅 `optional` 且声明了 `default`）
   - `[choices: ...]`（声明了 `choices`）
4. 元信息顺序固定为：`[type: ...] [default: ...] [choices: ...]`。
5. `default` 与 `choices` 的值展示使用 `JSON.stringify`：
   - `[default: {JSON.stringify(value)}]`
   - `[choices: {choices.map(JSON.stringify).join(', ')}]`
6. `Arguments` / `Options` / `Commands` 三个 section 的描述列起始位置必须全局对齐：
   - 先收集三者所有签名列（`signature/name`），计算统一 `labelWidth`（按显示宽度计算，ASCII=1，CJK=2）。
   - 每行渲染为：`  {label.padEnd(labelWidth)}  {desc}`。
   - plain/terminal 渲染必须复用同一套 display-width helper，禁止各自实现不同宽度算法。
   - 显示宽度计算必须忽略 ANSI 转义序列；combining mark 记为宽度 0。
   - 终端彩色渲染下，颜色转义序列不计入宽度。

```
Process Manager

Usage: pm [options] [command] <target> [mode] <extras...>

Arguments:
  <target>            Deploy target [type: string]
  [mode]              Deploy mode [type: choice] [default: "safe"] [choices: "safe", "force"]
  <extras...>         Extra files [type: string]

Options:
      --help          Show help information
      --version       Show version number
      --color         Enable colored help output
  -v, --verbose       Verbose output

Commands:
  help                Show help for a command
  start, s            Start a process
  stop                Stop a process

Examples:
  - Start In Background
    pm start myapp --detach
    Start process in daemon mode

  - Watch Build
    pm start --verbose myapp
    Run start command with verbose logging
```

---

## 完整示例

```typescript
import { Command } from '@guanghechen/commander/browser'
import { CompletionCommand } from '@guanghechen/commander/node'

const pm = new Command({ name: 'pm', desc: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', args: 'none', desc: 'Verbose' })
  .option({ long: 'config', short: 'c', type: 'string', args: 'required', desc: 'Config' })

const start = new Command({ desc: 'Start a process' })
  .argument({ name: 'name', desc: 'Process name', kind: 'required', type: 'string' })
  .option({ long: 'detach', short: 'd', type: 'boolean', args: 'none', desc: 'Background' })
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
