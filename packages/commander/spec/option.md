# 选项系统

选项的定义、继承与解析。

---

## 命名规范

| 场景                        | 格式                       | 示例          |
| --------------------------- | -------------------------- | ------------- |
| `ICommandOptionConfig.long` | camelCase                  | `logLevel`    |
| 命令行输入                  | kebab-case（大小写不敏感） | `--log-level` |
| help / 错误提示             | kebab-case（全小写）       | `--log-level` |

详见 [charter.md](./charter.md) §3。

---

## 类型定义

```typescript
/** 值类型 */
type ICommandOptionType = 'boolean' | 'number' | 'string'

/** 参数模式 */
type ICommandOptionArgs = 'none' | 'required' | 'optional' | 'variadic'

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

| type      | args       | 默认解析类型         | 示例                       |
| --------- | ---------- | -------------------- | -------------------------- |
| `boolean` | `none`     | `boolean`            | `--verbose`                |
| `string`  | `required` | `string`             | `--output file`            |
| `string`  | `optional` | `string / undefined` | `--write` / `--write path` |
| `number`  | `required` | `number`             | `--port 8080`              |
| `string`  | `variadic` | `string[]`           | `--files a.txt b.txt`      |
| `number`  | `variadic` | `number[]`           | `--ports 80 443`           |

说明：若提供 `coerce`：

1. `none/required` 的输出类型为 `T`。
2. `optional` 的输出类型为 `T | undefined`。
3. `variadic` 的输出类型为 `T[]`（元素级 coerce）。

`optional` 约束：

1. 当前仅允许 `type: 'string', args: 'optional'`。
2. 当 token 为裸 `--long` / `-s` 且未消费到值时，解析结果为 `undefined`。
3. 当 token 为 `--long=` 时，解析结果为 `''`（空字符串）。
4. 当 token 为 `--long=<value>` 或 `--long <value>`（`<value>` 非 option token）时，解析结果为该值。
5. 当 option 未出现时，读取该字段同样可能得到 `undefined`；若需区分“未出现”与“显式传入无值”，必须结合 key 存在性判断（如 `Object.prototype.hasOwnProperty.call(opts, 'write')`）。

`required` 约束：

1. `required` 仅表示“该 option 必须出现”（presence），不等价于 `args: 'required'`。
2. `required: true` 仅允许与 `args: 'required'` 组合。
3. `required: true` 与 `args: 'optional'` / `args: 'variadic'` 组合属于非法配置（构建期 `ConfigurationError`）。

**非法组合**（构建时报错）：

| type      | args       | 原因                     |
| --------- | ---------- | ------------------------ |
| `boolean` | `required` | boolean 不接受参数       |
| `boolean` | `optional` | boolean 不接受参数       |
| `boolean` | `variadic` | boolean 不接受参数       |
| `string`  | `none`     | string/number 必须有参数 |
| `number`  | `none`     | string/number 必须有参数 |
| `number`  | `optional` | optional 仅支持 string   |

---

## 参数消费规则

resolve 阶段按 `args` 贪婪消费后续 tokens：

| args       | 消费行为                                           |
| ---------- | -------------------------------------------------- |
| `none`     | 不消费参数                                         |
| `required` | 消费一个参数                                       |
| `optional` | 优先消费一个参数；若后续为 option 或不存在则不消费 |
| `variadic` | 持续消费，直到遇到 `-` 开头的 token                |

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
--write (optional): 若后续为普通 token 则消费一个；否则不消费 value token（落值语义见下）
--files (variadic): 消费 a.txt, b.txt → 遇到 --verbose 停止
--verbose (none): 不消费
c.txt → 位置参数
```

`optional` 示例：

```bash
mycli completion --fish --write            # write = undefined（字段存在，使用 shell 默认路径）
mycli completion --fish                    # write 字段不存在（读取为 undefined）
mycli completion --fish --write=           # write = ''
mycli completion --fish --write out.fish   # write = 'out.fish'
mycli completion --fish --write=out.fish   # write = 'out.fish'
mycli completion --fish --write undefined  # write = 'undefined'
```

### optional 的 key 存在性与 default 回退

1. 解析结果允许“值语义”和“存在语义”同时生效：`opts.write` 可为 `undefined`，但 key 仍可能存在。
2. `default` 回退仅在 key 不存在时触发；key 已存在（即使值为 `undefined` / `''`）也不回退。
3. 判定是否显式传入 option，必须使用 key 存在性判断，而非仅比较值是否为 `undefined`。
4. `apply` 触发仍按值语义：当值为 `undefined` 时不触发 `apply`，即使 key 存在也不触发。

---

## number 值语法与负数输入

`type: 'number'` 的 option 解析规则：

1. 输入值必须符合 JS primitive number 字面量语法；支持 numeric separator（`_`）。
2. 语义等价于：按字面量语法预校验后移除 `_`，再执行 `Number(raw)` 转换。
3. 支持十进制 / 科学计数法 / 二进制(`0b`) / 八进制(`0o`) / 十六进制(`0x`)。
   例如：`+1`、`.5`、`1.`、`1_000`、`1e3`、`0b1010`、`0o755`、`0x10`。
4. 非十进制前缀值仅支持无符号形式：`0x...` / `0b...` / `0o...`。
   带符号形式（如 `+0x10`、`-0x10`、`+0b10`、`-0b10`、`+0o10`、`-0o10`）视为非法输入。
5. 不接受空串、纯空白、`NaN`、`Infinity`、`-Infinity` 与其他非法字面量；命中时报 `InvalidType`。
6. 负数值必须使用长选项内联 `=` 语法：`--long=-1`（同样适用于所有负数输入）。
7. `--long -1` 与 `-o -1` 中的 `-1` 会被识别为 option token，不作为 value。
8. 短选项不支持 `=` 语法（包含 `-o=-1` 与其他 `-o=value`）。

示例：

```bash
mycli --number=1e3      # ✅
mycli --number=0x10     # ✅
mycli --number=+1       # ✅
mycli --number=.5       # ✅
mycli --number=1.       # ✅
mycli --number=1_000    # ✅
mycli --number=-1       # ✅
mycli --number=-16      # ✅
mycli --number=+0x10    # ❌ 非十进制前缀不支持显式正号
mycli --number=-0x10    # ❌ 非十进制前缀不支持显式负号
mycli --number -1       # ❌ -1 被识别为选项
mycli -n -1             # ❌ -1 被识别为选项
mycli -n=-1             # ❌ 不支持短选项赋值语法
mycli --numbers=-1 --numbers=-2  # ✅ variadic 重复长选项
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

| 规则          | 说明                                           |
| ------------- | ---------------------------------------------- |
| 执行时机      | 解析到选项值后立即调用                         |
| 作用域        | 每个值单独调用（variadic 逐项）                |
| variadic 结果 | 元素类型为 `coerce` 返回类型，整体为数组 `T[]` |
| 顺序          | 先 coerce，再 choices 校验                     |
| 异常          | 抛出异常则中止解析                             |

补充：`args='optional'` 时：

1. 裸 `--long` / `-s`（值为 `undefined`）不执行 `coerce`。
2. `--long=`（值为 `''`）与 `--long=<value>`（值为非空字符串）会执行 `coerce`。

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

| 规则     | 说明                               |
| -------- | ---------------------------------- |
| 执行时机 | parse 阶段，tokens → opts 之后     |
| 执行顺序 | 自顶向下（root → leaf）            |
| 触发条件 | 仅在值非 undefined 时执行          |
| 覆盖行为 | 子命令覆盖选项时使用子命令的 apply |

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

| long     | 来源 |
| -------- | ---- |
| verbose  | root |
| logLevel | sub  |
| watch    | sub  |

`long` 是唯一标识，`short` 仅是 alias。

---

## 预置输入（Profile Manifest）

为支持“在单文件中管理多命令 preset”，当前采用 profile manifest：

```bash
mycli run --preset-file=./preset.json --preset-profile=dev:ci
```

入口语法：

1. `--preset-file=<file>` 或 `--preset-file <file>`。
2. `--preset-profile=<profile[:variant]>` 或 `--preset-profile <profile[:variant]>`。
3. `--` 之后出现的 `--preset-*` 视为普通参数，不参与 preset 阶段。
4. `--preset-root` 已移除。

manifest 示例：

```json
{
  "version": 1,
  "defaults": { "profile": "dev" },
  "profiles": {
    "dev": {
      "envFile": "dev.env",
      "envs": { "NODE_ENV": "development" },
      "opts": { "mode": "fast", "retry": 2 },
      "defaultVariant": "local",
      "variants": {
        "local": {
          "opts": { "retry": 1 }
        },
        "ci": {
          "envFile": "ci.env",
          "envs": { "NODE_ENV": "test" },
          "opts": { "retry": 5 }
        }
      },
      "suitable": ["mycli run", "mycli build"]
    }
  }
}
```

`<file>` 值合法性（适用于 `--preset-file` / `command.preset.file` / 选中 profile/variant 的 `envFile`）：

1. 当该值被采用时，必须指向存在且可读的文件路径。

`<profile[:variant]>` 值合法性（实现约束）：

1. `<profile>` 必须匹配正则：`[A-Za-z0-9][A-Za-z0-9._-]*`。
2. `<variant>`（若存在）必须匹配正则：`[A-Za-z0-9][A-Za-z0-9._-]*`。
3. 仅允许 0 或 1 个 `:` 分隔符。

### `--preset-file=<file>`

语义：

1. 读取并解析 JSON manifest（`version` 必须为 `1`）。
2. `profiles` 必须是对象，profile key 必须是合法 profile 名。
3. 若读取失败或 JSON 解析失败，立即报 `ConfigurationError`。

### `--preset-profile=<profile[:variant]>`

语义：

1. 不能脱离 `--preset-file` 单独使用。
2. 若 CLI 未声明 `--preset-file` / `--preset-profile`，可回退 `command.preset.file` / `command.preset.profile`（二者独立决议，均按 `leaf -> ... -> root` 首命中）。
3. CLI 显式优先级高于 command preset 默认：`--preset-file` 覆盖 `command.preset.file`，`--preset-profile` 覆盖 `command.preset.profile`。
4. profile selector 决议顺序：`--preset-profile` > `command.preset.profile` > `manifest.defaults.profile`。
5. 若 profile 缺失、未知或不适用于当前命令，立即报 `ConfigurationError`。

### profile 字段语义

1. `suitable: string[]`：必填，表示可应用该 profile 的 routed command path 列表（精确匹配）。
2. `envFile?: string`：可选，若为相对路径则相对 `preset-file` 所在目录解析，再按 `@guanghechen/env.parse` 解析。
3. `envs?: Record<string, string>`：可选，覆盖 `envFile` 同名键。
4. `opts?: Record<string, boolean | string | number | (string | number)[]>`：可选，转为 option token 片段注入 preset argv。
5. `defaultVariant?: string`：可选，未显式指定 variant 时使用。
6. `variants?: Record<string, { envFile?: string; envs?: Record<string, string>; opts?: Record<string, boolean | string | number | (string | number)[]> }>`：可选，命中 variant 时以 `base + variant` 覆盖合并。

### 优先级

值覆盖优先级：

| 维度      | 覆盖顺序（高 -> 低）                                                      |
| --------- | ------------------------------------------------------------------------- |
| option 值 | user CLI token > profile `opts` 注入 token > option `default`            |
| env 值    | variant `envs` > variant `envFile` > profile `envs` > profile `envFile` > `ctx.sources.user.envs` |

注意：

1. `profile.opts` 会被转成 token 片段，因此其覆盖行为与普通 CLI token 一致。
2. `NO_COLOR` 判断仍基于合并后的 `ctx.envs`。

### 强制约束

| 约束                                                                   | 目的                           |
| ---------------------------------------------------------------------- | ------------------------------ |
| profile `opts` 生成的 token 仅允许 option 片段（`-x`/`--xxx` 及其参数值） | 避免污染命令路由和位置参数语义 |
| 在 profile `opts` 生成 token 中禁止 `--preset-file` / `--preset-profile` | 防止递归载入 profile manifest  |
| 在 profile `opts` 生成 token 中禁止声明 `help` / `--help` / `--version`  | 保持 run 控制项提前中断语义    |
| 在 profile `opts` 生成 token 中禁止出现 `--` 分隔符                      | 避免污染位置参数分段语义       |
| preset 文件统一使用 UTF-8 编码                                         | 降低跨平台解析歧义             |
| 显式声明的 preset 文件读取失败或格式错误直接报错                       | 避免静默降级导致行为不可预测   |

### 边界行为

1. 对 `boolean` / `required` / `optional`：右侧 token 覆盖左侧 token（Last Write Wins）。
2. 对 `variadic`：左侧和右侧按出现顺序累积。
3. 显式 `--color/--no-color` 优先于 `NO_COLOR` fallback。

### 错误语义

| 场景                                                   | 行为约定                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `--preset-file` / `--preset-profile` 缺少值            | 立即报错并终止                                                               |
| 被采用的 `--preset-file` / `command.preset.file` / 选中 profile/variant 的 `envFile` 指向无效文件路径 | 立即报错并终止（不存在、不可读或为目录） |
| `--preset-profile` 非法                               | 立即报错并终止（不匹配 `<profile>` / `<profile>:<variant>`）                 |
| 仅提供 `--preset-profile` 未提供 `--preset-file`      | 立即报错并终止                                                               |
| `command.preset.profile` 存在但无法决议出 preset file | 立即报错并终止                                                               |
| preset manifest 不是合法 JSON 或 schema 非法           | 立即报错并终止                                                               |
| profile 未找到 / 无默认 profile                         | 立即报错并终止                                                               |
| variant 未找到 / `defaultVariant` 未命中 `variants`    | 立即报错并终止                                                               |
| profile 与当前 routed command path 不匹配（`suitable` 不命中） | 立即报错并终止                                                           |
| 选中 profile/variant 的 `envFile` 不存在/不可读或解析失败 | 立即报错并终止                                                            |
| profile `opts` 生成 token 中存在无法组成 option 片段的 token | 立即报错并终止（例如布尔选项后出现孤立 value）                            |
| profile `opts` 生成 token 中出现 `--preset-file` / `--preset-profile` | 立即报错并终止（禁止递归与跨类型引用）                                  |
| profile `opts` 生成 token 中出现 `--help` / `help` / `--version` | 立即报错并终止（控制项仅允许来自 user tail 并提前中断）                 |
| profile `opts` 生成 token 中出现 `--`                  | 立即报错并终止（不允许位置参数分隔符）                                       |
| `--preset-opts` / `--preset-envs`                      | 非法指令，按未知选项处理（`UnknownOption`）                                  |
| `--` 之后的 `--preset-*`                               | 不作为 preset 指令，按普通参数处理                                           |
| `run()` 命中控制项 short-circuit                       | 不读取任何 preset 文件，直接结束流程                                         |

其中“无法组成 option 片段”的判定规则为（针对 profile `opts` 生成 token）：

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
- `required` 仅允许搭配 `args: 'required'`
- `long: 'help'` / `long: 'version'` 属于保留名，不允许自定义
- `long` 必须 camelCase 且不能以 `no` 开头
- `short` 若提供，必须是单字符
- `short` 不能冲突

**运行时**：

- required 检查
- choices 校验
- type 校验
- boolean 值校验（仅 true/false）
- `--no-xxx` 仅用于 `type: 'boolean', args: 'none'`
- `--no-help` / `--no-version` 非法（`help/version` 为控制语义保留项，negative 形式按 unknown option 处理）
- unknown option 报错

---

## 预定义选项

Commander 提供了常用选项的预定义对象，减少模板代码：

```typescript
import {
  logColorfulOption,
  logDateOption,
  logLevelOption,
  silentOption,
} from '@guanghechen/commander/browser'

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
import { Coerce } from '@guanghechen/commander/browser'

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

| 属性     | 值                        |
| -------- | ------------------------- |
| 输入     | `string`                  |
| 输出     | `(raw: string) => number` |
| 校验规则 | `Number.isFinite(value)`  |

### Coerce.integer

| 属性     | 值                        |
| -------- | ------------------------- |
| 输入     | `string`                  |
| 输出     | `(raw: string) => number` |
| 校验规则 | `Number.isInteger(value)` |

### Coerce.positiveInteger

| 属性     | 值                                     |
| -------- | -------------------------------------- |
| 输入     | `string`                               |
| 输出     | `(raw: string) => number`              |
| 校验规则 | `Number.isInteger(value) && value > 0` |

### Coerce.positiveNumber

| 属性     | 值                                    |
| -------- | ------------------------------------- |
| 输入     | `string`                              |
| 输出     | `(raw: string) => number`             |
| 校验规则 | `Number.isFinite(value) && value > 0` |

### logLevelOption

日志级别选项，支持 `debug | info | hint | warn | error`：

| 属性      | 值                           |
| --------- | ---------------------------- |
| `long`    | `'logLevel'`                 |
| `type`    | `'string'`                   |
| `args`    | `'required'`                 |
| `default` | `'info'`                     |
| `choices` | 所有日志级别                 |
| `coerce`  | 大小写不敏感                 |
| `apply`   | `ctx.reporter.setLevel(val)` |

### silentOption

静默输出选项：

| 属性      | 值          |
| --------- | ----------- |
| `long`    | `'silent'`  |
| `type`    | `'boolean'` |
| `args`    | `'none'`    |
| `default` | `false`     |

### logDateOption

日志时间戳控制选项：

| 属性      | 值                                      |
| --------- | --------------------------------------- |
| `long`    | `'logDate'`                             |
| `type`    | `'boolean'`                             |
| `args`    | `'none'`                                |
| `default` | `true`                                  |
| `apply`   | `ctx.reporter.setFlight({ date: val })` |

### logColorfulOption

日志彩色输出控制选项：

| 属性      | 值                                       |
| --------- | ---------------------------------------- |
| `long`    | `'logColorful'`                          |
| `type`    | `'boolean'`                              |
| `args`    | `'none'`                                 |
| `default` | `true`                                   |
| `apply`   | `ctx.reporter.setFlight({ color: val })` |
