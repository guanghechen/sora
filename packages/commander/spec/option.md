# 选项系统

选项的定义、继承与解析。

---

## 命名规范

| 场景                         | 格式                       | 示例          |
| ---------------------------- | -------------------------- | ------------- |
| `ICommandOptionConfig.long`  | camelCase                  | `logLevel`    |
| 命令行输入                   | kebab-case（大小写不敏感） | `--log-level` |
| help / 错误提示              | kebab-case（全小写）       | `--log-level` |

详见 [charter.md](./charter.md) §3。

---

## 类型定义

```typescript
/** 值类型 */
type ICommandOptionType = 'boolean' | 'number' | 'string'

/** 参数模式 */
type ICommandOptionArgs = 'none' | 'required' | 'variadic'

/** 选项配置 */
interface ICommandOptionConfig<T = unknown> {
  long: string                    // 长选项名（camelCase，必填）
  short?: string                  // 短选项（单字符）
  type: ICommandOptionType        // 值类型（必填）
  args: ICommandOptionArgs        // 参数模式（必填）
  desc: string                    // 描述文本
  required?: boolean              // 是否必需
  default?: T                     // 默认值
  choices?: T[]                   // 允许的值列表
  coerce?: (raw: string) => T     // 单值转换
  apply?: (value: T, ctx: ICommandContext) => void
}

/** token 类型 */
type ICommandTokenType = 'long' | 'short' | 'none'

/** 命令 token */
interface ICommandToken {
  original: string        // 原始输入：--LOG-LEVEL=info, -v
  resolved: string        // 规范化后：--logLevel=info, -v
  name: string            // 选项名：logLevel, v, ''
  type: ICommandTokenType
}

// 注意：`args: 'none'` 与 `token.type: 'none'` 语义不同。
// 前者表示选项不接参数，后者表示该 token 不是选项。
```

---

## type × args 组合

`type` 和 `args` **必须同时指定**，组合决定默认解析类型：

| type       | args       | 默认解析类型 | 示例                  |
| ---------- | ---------- | ------------ | --------------------- |
| `boolean`  | `none`     | `boolean`    | `--verbose`           |
| `string`   | `required` | `string`     | `--output file`       |
| `number`   | `required` | `number`     | `--port 8080`         |
| `string`   | `variadic` | `string[]`   | `--files a.txt b.txt` |
| `number`   | `variadic` | `number[]`   | `--ports 80 443`      |

说明：若提供 `coerce`，`none/required` 的输出类型为 `T`，`variadic` 的输出类型为 `T[]`（元素级 coerce）。

**非法组合**（构建时报错）：

| type       | args       | 原因                     |
| ---------- | ---------- | ------------------------ |
| `boolean`  | `required` | boolean 不接受参数       |
| `boolean`  | `variadic` | boolean 不接受参数       |
| `string`   | `none`     | string/number 必须有参数 |
| `number`   | `none`     | string/number 必须有参数 |

---

## 参数消费规则

resolve 阶段按 `args` 贪婪消费后续 tokens：

| args        | 消费行为                            |
| ----------- | ----------------------------------- |
| `none`      | 不消费参数                          |
| `required`  | 消费一个参数                        |
| `variadic`  | 持续消费，直到遇到 `-` 开头的 token |

**`=` 语法**：值内嵌时立刻停止，不再贪婪：

```
--files=first.txt a.txt b.txt
  → files: ['first.txt']
  → a.txt, b.txt 作为位置参数
```

**消费示例**：

```
tokens: [--output, foo.txt, --files, a.txt, b.txt, --verbose, c.txt]

--output (required): 消费 foo.txt → 停止
--files (variadic): 消费 a.txt, b.txt → 遇到 --verbose 停止
--verbose (none): 不消费
c.txt → 位置参数
```

---

## Coerce

单值转换，替代内置类型转换：

```typescript
.option({
  long: 'port',
  type: 'number',
  args: 'variadic',
  desc: 'Ports',
  coerce: (v) => {
    const n = parseInt(v, 10)
    if (n < 0 || n > 65535) throw new Error('Invalid port')
    return n
  },
})
// --port 80 443 → [80, 443]
```

| 规则          | 说明                                               |
| ------------- | -------------------------------------------------- |
| 执行时机      | 解析到选项值后立即调用                             |
| 作用域        | 每个值单独调用（variadic 逐项）                    |
| variadic 结果 | 元素类型为 `coerce` 返回类型，整体为数组 `T[]`     |
| 顺序          | 先 coerce，再 choices 校验                         |
| 异常          | 抛出异常则中止解析                                 |

---

## Apply

parse 阶段将解析后的值应用到 context：

```typescript
.option({
  long: 'logLevel',
  type: 'string',
  args: 'required',
  desc: 'Log level',
  choices: ['debug', 'info', 'hint', 'warn', 'error'],
  default: 'info',
  apply: (value, ctx) => {
    ctx.reporter.setLevel(value)
  },
})
```

| 规则       | 说明                               |
| ---------- | ---------------------------------- |
| 执行时机   | parse 阶段，tokens → opts 之后     |
| 执行顺序   | 自顶向下（root → leaf）            |
| 触发条件   | 仅在值非 undefined 时执行          |
| 覆盖行为   | 子命令覆盖选项时使用子命令的 apply |

---

## 继承与合并

子命令**强制继承**祖先链上所有选项，使用 `long` 作为 key 覆盖：

```typescript
const root = new Command({ name: 'cli', desc: 'CLI' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', args: 'none', desc: 'Verbose' })
  .option({ long: 'logLevel', type: 'string', args: 'required', desc: 'Log level' })

const sub = new Command({ desc: 'Build' })
  .option({ long: 'logLevel', type: 'string', args: 'required', desc: 'Build log' })  // 覆盖
  .option({ long: 'watch', short: 'w', type: 'boolean', args: 'none', desc: 'Watch' })

root.subcommand('build', sub)
```

`cli build --log-level debug` 合并后：

| long      | 来源 |
| --------- | ---- |
| verbose   | root |
| logLevel  | sub  |
| watch     | sub  |

`long` 是唯一标识，`short` 仅是 alias。

---

## 预置输入文件（拟议）

为支持“从文件注入预置输入”，新增两个 preset 入口：

```bash
mycli --preset-opts=./options.argv --preset-envs=./preset.env --log-level debug
```

入口语法（拟议）：

1. `--preset-opts=<file>` 或 `--preset-opts <file>`。
2. `--preset-envs=<file>` 或 `--preset-envs <file>`。
3. 可多次出现，按命令行出现顺序处理。
4. 相对路径按当前进程工作目录（cwd）解析。
5. `--` 之后出现的 `--preset-*` 视为普通参数，不参与 preset 阶段。

### `--preset-opts=<file>`

语义：

1. 在 PRESET 阶段执行时读取 `<file>`，得到 `ctx.sources.preset.argv: string[]`。
2. 若配置多个 options 文件，按出现顺序拼接为单一 `ctx.sources.preset.argv`。
3. 从 `CONTROL SCAN` 阶段产出的 `controlTailArgv` 中移除 preset 指令，得到 `ctx.sources.user.argv`（clean argv）。
4. 组装 `effectiveTailArgv = [...ctx.sources.preset.argv, ...ctx.sources.user.argv]`。
5. 将来源快照挂载到 `ctx.sources`（`preset/user`）。
6. 后续沿用 tokenize/resolve/parse 流程。
7. 若 `run()` 在 RUN CONTROL 阶段命中 short-circuit，则不会读取 options preset 文件。

文件内容语义：

1. 按 whitespace 分词，换行与空格等价。
2. 支持多行输入，空行会被忽略。
3. 不做 shell quote/escape 语义解析（仅按 whitespace 切分）。
4. 每个分词结果按顺序进入 `ctx.sources.preset.argv`。

示例（与单行 `--log-level info --color` 等价）：

```text
--log-level
info
--color
```

### `--preset-envs=<file>`

语义：

1. 在 PRESET 阶段执行时读取 `<file>`。
2. 使用 `@guanghechen/env` 的 `parse(content)` 解析为 env 记录。
3. 若配置多个 env 文件，按出现顺序合并，后者覆盖前者，得到 `ctx.sources.preset.envs`。
4. 组装 `ctx.envs = { ...ctx.sources.user.envs, ...ctx.sources.preset.envs }`。
5. 将来源快照挂载到 `ctx.sources`（`preset/user`）。
6. 后续 parse/run 阶段统一使用 `ctx.envs`。
7. 若 `run()` 在 RUN CONTROL 阶段命中 short-circuit，则不会读取 envs preset 文件。

文件格式约束：

1. `<file>` 必须符合 `packages/env`（`@guanghechen/env`）可解析语法。
2. 解析失败直接报错，不做静默降级。

### 优先级

选项值优先级（同一命令层内）：

| 来源                               | 优先级说明                                           |
| ---------------------------------- | ---------------------------------------------------- |
| CLI（用户实时输入）                | 最高；位于 `effectiveTailArgv` 右侧，覆盖左侧        |
| preset-opts（文件注入）            | 中间；覆盖命令定义 `default`                         |
| env fallback（当前仅 `NO_COLOR`）  | 仅在未出现对应选项 token 时生效                      |
| option `default` / 隐式默认        | 最低（`boolean=false`、`variadic=[]`）               |

环境变量优先级：

| 来源                         | 优先级说明                                     |
| ---------------------------- | ---------------------------------------------- |
| `ctx.sources.preset.envs`    | 最高（来自 `--preset-envs` 文件）              |
| `ctx.sources.user.envs`      | 次高（调用方传入，如 `process.env`）           |

注意：

1. `preset-opts` 是“显式 token 注入”，不是 `default` 字段替代。
2. `NO_COLOR` 判断基于 `ctx.envs`。

### 强制约束（拟议）

| 约束                                                              | 目的                              |
| ----------------------------------------------------------------- | --------------------------------- |
| option 文件仅允许 option 片段（`-x`/`--xxx` 及其参数值）          | 避免污染命令路由和位置参数语义    |
| 在 options preset 文件中禁止声明 `--preset-opts`                  | 防止递归加载                      |
| 在 options preset 文件中禁止声明 `--preset-envs`                  | 防止跨类型递归与来源混乱          |
| 在 options preset 文件中禁止声明 `help` / `--help` / `--version`  | 保持 run 控制项提前中断语义       |
| 在 options preset 文件中禁止出现 `--` 分隔符                      | 避免污染位置参数分段语义          |
| preset 文件统一使用 UTF-8 编码                                    | 降低跨平台解析歧义                |
| preset 文件读取失败或格式错误直接报错                             | 避免静默降级导致行为不可预测      |

### 边界行为

1. 对 `boolean` / `required`：右侧 token 覆盖左侧 token（Last Write Wins）。
2. 对 `variadic`：左侧和右侧按出现顺序累积。
3. 若 `preset-opts` 或 CLI 显式给出 `--color/--no-color`，优先于 `NO_COLOR` fallback。
4. `preset-envs` 同 key 多次定义时，以 `@guanghechen/env` 的解析结果为准（后写覆盖前写）。

### 错误语义（拟议）

| 场景                                                    | 行为约定                                                 |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `--preset-opts` / `--preset-envs` 缺少值                | 立即报错并终止                                           |
| preset 文件不存在或不可读                               | 立即报错并终止                                           |
| options 文件分词后存在无法组成 option 片段的 token      | 立即报错并终止（例如文件开头裸 token）                   |
| options 文件中出现 `--preset-opts` / `--preset-envs`    | 立即报错并终止（禁止递归与跨类型引用）                   |
| options 文件中出现 `--help` / `help` / `--version`      | 立即报错并终止（控制项仅允许来自 user tail 并提前中断）  |
| options 文件中出现 `--`                                 | 立即报错并终止（不允许位置参数分隔符）                   |
| envs 文件不符合 `@guanghechen/env` 语法                 | 立即报错并终止（包装为 `ConfigurationError`）            |
| `--` 之后的 `--preset-*`                                | 不作为 preset 指令，按普通参数处理                       |
| `run()` 命中控制项 short-circuit                        | 不读取任何 preset 文件，直接结束流程                     |

其中“无法组成 option 片段”的判定规则为：

1. 分词序列必须由若干 `option-token + value-token*` 片段组成。
2. 每个片段必须以 `-`/`--` 开头 token 起始。
3. 任一不以 `-`/`--` 开头且无法归属到前一 option 的 token，视为非法裸 token。
4. value-token 的归属由目标 option 的 `args` 在 resolve 阶段判定。

---

## 校验规则

详见 [charter.md](./charter.md) §8。

**构建时**：

- `type` + `args` 非法组合
- `required` + `default` 互斥
- `boolean` + `required` 互斥
- `long: 'help'` / `long: 'version'` 属于保留名，不允许自定义
- `long` 必须 camelCase 且不能以 `no` 开头
- `short` 不能冲突

**运行时**：

- required 检查
- choices 校验
- type 校验
- boolean 值校验（仅 true/false）
- `--no-xxx` 仅用于 boolean
- unknown option 报错

---

## 已知限制

负数值仅支持长选项内联 `=` 语法：

```bash
mycli -n -1        # ❌ -1 被识别为选项
mycli --number -1  # ❌ -1 被识别为选项
mycli --number=-1  # ✅ 长选项 = 语法
```

---

## 预定义选项

Commander 提供了常用选项的预定义对象，减少模板代码：

```typescript
import {
  logColorfulOption,
  logDateOption,
  logLevelOption,
  silentOption,
} from '@guanghechen/commander'

const cmd = new Command({ name: 'app', desc: 'Application' })
  .option(logLevelOption)   // --log-level
  .option(silentOption)     // --silent
  .option(logDateOption)    // --log-date
  .option(logColorfulOption) // --log-colorful

// 使用展开语法覆盖属性
.option({ ...logLevelOption, default: 'warn' })
```

## 预定义 Coerce 工厂

Commander 也提供了常用的 `coerce` 工厂方法：

```typescript
import { Coerce } from '@guanghechen/commander'

cmd
  .option({
    long: 'offset',
    type: 'number',
    args: 'required',
    coerce: Coerce.integer('--offset'),
    desc: 'Signed offset',
  })
  .option({
    long: 'parallel',
    type: 'number',
    args: 'required',
    coerce: Coerce.positiveInteger('--parallel'),
    desc: 'Parallel workers',
  })
  .option({
    long: 'duration',
    type: 'number',
    args: 'required',
    coerce: Coerce.positiveNumber('--duration'),
    desc: 'Duration seconds',
  })
  .option({
    long: 'scale',
    type: 'number',
    args: 'required',
    coerce: Coerce.number('--scale'),
    desc: 'Scale factor',
  })
```

默认错误文案：

```text
{name} is expected as {coerce type}, but got {raw}
```

如需自定义，也可传第二个参数：`Coerce.xxx(name, 'custom error message')`。

### Coerce.number

| 属性     | 值                                     |
| -------- | -------------------------------------- |
| 输入     | `string`                               |
| 输出     | `(raw: string) => number`              |
| 校验规则 | `Number.isFinite(value)`               |

### Coerce.integer

| 属性     | 值                                     |
| -------- | -------------------------------------- |
| 输入     | `string`                               |
| 输出     | `(raw: string) => number`              |
| 校验规则 | `Number.isInteger(value)`              |

### Coerce.positiveInteger

| 属性     | 值                                     |
| -------- | -------------------------------------- |
| 输入     | `string`                               |
| 输出     | `(raw: string) => number`              |
| 校验规则 | `Number.isInteger(value) && value > 0` |

### Coerce.positiveNumber

| 属性     | 值                                     |
| -------- | -------------------------------------- |
| 输入     | `string`                               |
| 输出     | `(raw: string) => number`              |
| 校验规则 | `Number.isFinite(value) && value > 0`  |

### logLevelOption

日志级别选项，支持 `debug | info | hint | warn | error`：

| 属性       | 值                           |
| ---------- | ---------------------------- |
| `long`     | `'logLevel'`                 |
| `type`     | `'string'`                   |
| `args`     | `'required'`                 |
| `default`  | `'info'`                     |
| `choices`  | 所有日志级别                 |
| `coerce`   | 大小写不敏感                 |
| `apply`    | `ctx.reporter.setLevel(val)` |

### silentOption

静默输出选项：

| 属性       | 值          |
| ---------- | ----------- |
| `long`     | `'silent'`  |
| `type`     | `'boolean'` |
| `args`     | `'none'`    |
| `default`  | `false`     |

### logDateOption

日志时间戳控制选项：

| 属性       | 值                                       |
| ---------- | ---------------------------------------- |
| `long`     | `'logDate'`                              |
| `type`     | `'boolean'`                              |
| `args`     | `'none'`                                 |
| `default`  | `true`                                   |
| `apply`    | `ctx.reporter.setFlight({ date: val })`  |

### logColorfulOption

日志彩色输出控制选项：

| 属性       | 值                                        |
| ---------- | ----------------------------------------- |
| `long`     | `'logColorful'`                           |
| `type`     | `'boolean'`                               |
| `args`     | `'none'`                                  |
| `default`  | `true`                                    |
| `apply`    | `ctx.reporter.setFlight({ color: val })`  |
