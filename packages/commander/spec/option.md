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

## 预置输入文件

为支持“从文件注入预置输入”，新增三个 preset 入口：

```bash
mycli --preset-root=/abs/project --preset-opts=config/opt.ci --preset-envs=config/env.ci --log-level debug
```

入口语法：

1. `--preset-root=<abs-dir>` 或 `--preset-root <abs-dir>`。
2. `--preset-opts=<file>` 或 `--preset-opts <file>`。
3. `--preset-envs=<file>` 或 `--preset-envs <file>`。
4. `--preset-root` 可多次出现，按出现顺序覆盖（Last Write Wins）。
5. `--preset-opts` / `--preset-envs` 可多次出现，按出现顺序收集（collect）。
6. `--` 之后出现的 `--preset-*` 视为普通参数，不参与 preset 阶段。
7. PRESET 阶段固定顺序：先决议唯一 `presetRoot`，再解析/collect `--preset-opts` 与 `--preset-envs`。

`<file>` 值合法性（适用于显式声明的 preset file 参数：CLI + command.preset）：

1. 必须是非空字符串。
2. 不能以 `..` 开头。
3. 上述规则仅作用于显式 `<file>` 参数，不作用于默认文件名 `.opt.local/.env.local`。

`command.preset.opt` / `command.preset.env` 使用同一 `<file>` 合法性判定；不合法视为“未设置”，并回退默认文件名。
若其为相对路径，则按最终决议的 `presetRoot` 解析。

### `--preset-root=<abs-dir>`

语义：

1. `<abs-dir>` 必须是有效绝对目录（`isAbsolute(root) && stat(root).isDirectory()`），否则立即报 `ConfigurationError`。
2. 生效后作为 `--preset-opts` / `--preset-envs` 相对路径的 parent dir。
3. 若 `--preset-root` 多次出现，后者覆盖前者。
4. 当存在有效 preset root 且用户未显式提供对应 `--preset-opts` / `--preset-envs` 时，自动尝试默认文件：
   - options: `${presetRoot}/.opt.local`
   - envs: `${presetRoot}/.env.local`
5. 若默认文件不存在，按“可选默认输入”处理并忽略；若显式声明了 `--preset-opts` / `--preset-envs` 且文件不存在，则报错。

### Command preset 默认决议（强调）

`Command` 构造参数可声明：

```typescript
interface ICommandPresetConfig {
  root?: string
  opt?: string
  env?: string
}
```

决议规则（MUST）：

1. 在 `ctx.chain` 上按 `leaf -> ... -> root` 扫描，遇到第一个声明了 `command.preset.root` 的命令即停止。
2. 该命中的 `command.preset.root` 必须是有效绝对目录；若无效，立即报 `ConfigurationError`，且不得继续向上回退。
3. 命中后整份 `command.preset` 生效；即使 `opt/env` 未设置或无效，也直接回退默认文件名 `.opt.local/.env.local`。
4. CLI 覆盖优先级高于 command preset：
   - `--preset-root` 覆盖 `command.preset.root`
   - `--preset-opts` 覆盖 `command.preset.opt`（或其默认 `.opt.local`）
   - `--preset-envs` 覆盖 `command.preset.env`（或其默认 `.env.local`）
5. 若既没有有效 `command.preset.root`，也没有 CLI `--preset-root`，则不会自动尝试 `.opt.local/.env.local`。

### `--preset-opts=<file>`

语义：

1. 在 PRESET 阶段执行时读取 `<file>`，得到 `ctx.sources.preset.argv: string[]`。
2. 若配置多个 options 文件，按出现顺序拼接为单一 `ctx.sources.preset.argv`（collect）。
3. 从 `CONTROL SCAN` 阶段产出的 `controlTailArgv` 中移除 preset 指令，得到 `ctx.sources.user.argv`（clean argv）。
4. 组装 `effectiveTailArgv = [...ctx.sources.preset.argv, ...ctx.sources.user.argv]`。
5. 将来源快照挂载到 `ctx.sources`（`preset/user`）。
6. 后续沿用 tokenize/resolve/parse 流程。
7. 若 `run()` 在 RUN CONTROL 阶段命中 short-circuit，则不会读取 options preset 文件。
8. 当存在有效 `presetRoot` 且 `<file>` 为相对路径时，按 `presetRoot` 解析；否则按 `cwd` 解析。

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
3. 若配置多个 env 文件，按出现顺序收集并合并，后者覆盖前者，得到 `ctx.sources.preset.envs`。
4. 组装 `ctx.envs = { ...ctx.sources.user.envs, ...ctx.sources.preset.envs }`。
5. 将来源快照挂载到 `ctx.sources`（`preset/user`）。
6. 后续 parse/run 阶段统一使用 `ctx.envs`。
7. 若 `run()` 在 RUN CONTROL 阶段命中 short-circuit，则不会读取 envs preset 文件。
8. 当存在有效 `presetRoot` 且 `<file>` 为相对路径时，按 `presetRoot` 解析；否则按 `cwd` 解析。

文件格式约束：

1. `<file>` 必须符合 `packages/env`（`@guanghechen/env`）可解析语法。
2. 解析失败直接报错，不做静默降级。

### 优先级

为避免歧义，分两层描述：

1. preset 来源决议（先确定读取哪些文件与根目录）。
2. token/env 值覆盖（再确定最终值）。

preset 来源决议：

| 决议对象          | 规则                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `presetRoot`      | 先决议唯一 root：CLI `--preset-root` 后者覆盖前者；若未声明则回退 command preset root；若命中 root 无效则立即 `ConfigurationError` |
| `presetOptsFiles` | 在 root 决议后再 collect：按顺序收集 CLI `--preset-opts`；为空且有有效 root 才尝试默认文件                                         |
| `presetEnvsFiles` | 在 root 决议后再 collect：按顺序收集 CLI `--preset-envs`；为空且有有效 root 才尝试默认文件                                         |

值覆盖优先级：

| 维度           | 覆盖顺序（高 -> 低）                                             |
| -------------- | ---------------------------------------------------------------- |
| option 值      | user CLI token > preset-opts token > option `default` / 隐式默认 |
| env 值         | `ctx.sources.preset.envs` > `ctx.sources.user.envs`              |
| color fallback | 显式 `--color/--no-color` > `NO_COLOR` fallback                  |

注意：

1. `preset-opts` 是“显式 token 注入”，不是 `default` 字段替代。
2. `NO_COLOR` 判断基于 `ctx.envs`。

### 强制约束

| 约束                                                             | 目的                           |
| ---------------------------------------------------------------- | ------------------------------ |
| option 文件仅允许 option 片段（`-x`/`--xxx` 及其参数值）         | 避免污染命令路由和位置参数语义 |
| 在 options preset 文件中禁止声明 `--preset-root`                 | 防止递归改写 preset 根目录     |
| 在 options preset 文件中禁止声明 `--preset-opts`                 | 防止递归加载                   |
| 在 options preset 文件中禁止声明 `--preset-envs`                 | 防止跨类型递归与来源混乱       |
| 在 options preset 文件中禁止声明 `help` / `--help` / `--version` | 保持 run 控制项提前中断语义    |
| 在 options preset 文件中禁止出现 `--` 分隔符                     | 避免污染位置参数分段语义       |
| preset 文件统一使用 UTF-8 编码                                   | 降低跨平台解析歧义             |
| 显式声明的 preset 文件读取失败或格式错误直接报错                 | 避免静默降级导致行为不可预测   |

### 边界行为

1. 对 `boolean` / `required` / `optional`：右侧 token 覆盖左侧 token（Last Write Wins）。
2. 对 `variadic`：左侧和右侧按出现顺序累积。
3. 若 `preset-opts` 或 CLI 显式给出 `--color/--no-color`，优先于 `NO_COLOR` fallback。
4. `preset-envs` 同 key 多次定义时，以 `@guanghechen/env` 的解析结果为准（后写覆盖前写）。

### 错误语义

| 场景                                               | 行为约定                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `--preset-root` 缺少值                             | 立即报错并终止                                                                       |
| `--preset-root` 不是有效绝对目录                   | 立即报错并终止（`ConfigurationError`）                                               |
| `--preset-opts` / `--preset-envs` 缺少值           | 立即报错并终止                                                                       |
| `--preset-opts` / `--preset-envs` 的 `<file>` 非法 | 立即报错并终止（非空且不能以 `..` 开头）                                             |
| `command.preset.opt` / `command.preset.env` 非法   | 视为未设置并回退默认文件名（不报错）                                                 |
| 显式声明且路径合法的 preset 文件不存在或不可读     | 立即报错并终止（包括 CLI `--preset-opts/--preset-envs` 与 `command.preset.opt/env`） |
| 默认 preset 文件（`.opt.local/.env.local`）不存在  | 忽略（不报错）                                                                       |
| options 文件分词后存在无法组成 option 片段的 token | 立即报错并终止（例如文件开头裸 token）                                               |
| options 文件中出现任意 `--preset-*`                | 立即报错并终止（禁止递归与跨类型引用）                                               |
| options 文件中出现 `--help` / `help` / `--version` | 立即报错并终止（控制项仅允许来自 user tail 并提前中断）                              |
| options 文件中出现 `--`                            | 立即报错并终止（不允许位置参数分隔符）                                               |
| envs 文件不符合 `@guanghechen/env` 语法            | 立即报错并终止（包装为 `ConfigurationError`）                                        |
| `--` 之后的 `--preset-*`                           | 不作为 preset 指令，按普通参数处理                                                   |
| `run()` 命中控制项 short-circuit                   | 不读取任何 preset 文件，直接结束流程                                                 |

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
