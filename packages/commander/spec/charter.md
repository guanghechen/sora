# Design Charter

本文档定义 `@guanghechen/commander` 的核心设计原则与规范。

---

## 1. 设计目标

| 目标           | 说明                                      |
| -------------- | ----------------------------------------- |
| Tree Structure | Command 是树节点，子命令层级组合          |
| Type Safety    | 明确类型定义与稳定运行时契约              |
| Inheritance    | 选项沿祖先链继承，子节点可覆盖            |
| Decoupled      | 不隐式访问 `process.argv` / `process.env` |
| Explicit Entry | 必须显式使用 `/browser` 或 `/node` 入口   |
| Fluent API     | 链式调用构建命令                          |
| Strict Mode    | 严格解析，unknown option 报错             |
| Executable Spec | 关键规范约束必须可由运行时校验执行         |

### 1.1 执行流程

```
user argv → route → control-scan(run/parse) → control-run(run only) → preset → tokenize → builtin-resolve → resolve → parse → run
```

| 阶段                      | 方向     | 说明                                                                                                                                                                               |
| ------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| route                     | 自顶向下 | 基于 user argv 匹配 subcommand（name/alias），不改写 argv                                                                                                                          |
| control-scan（run/parse） | -        | 在 user tail（`--` 之前）识别控制语义：`--help` 按 token 扫描，`--version` 需 `supportsBuiltinVersion(leaf)`，`help` 仅 tail 首 token 生效，并写入 `ctx.controls` 后剥离控制 token |
| control-run（仅 run）     | -        | 依据 `ctx.controls` 执行 short-circuit，优先级 `help > version`                                                                                                                    |
| preset                    | -        | 加载 `--preset-file` / `--preset-profile` 并合并输入；preset file 来自 CLI 或 `command.preset.file`，profile selector（`<profile>` 或 `<profile>:<variant>`）优先来自 CLI / `command.preset.profile`，未显式指定时按 command-path suffix（`.`）→ `defaults.profile` → `default` 回退 |
| tokenize                  | -        | effective tail argv → `ICommandToken[]`（格式校验）                                                                                                                                |
| builtin-resolve           | -        | 解析当前 chain 的内建 option 注入策略，产出 `optionPolicyMap`                                                                                                                      |
| resolve                   | 自底向上 | 每个 Command 消费自己的 tokens                                                                                                                                                     |
| parse                     | 自顶向下 | tokens → opts，调用 apply 更新 ctx；对外暴露 leaf `builtin/opts/args`，其中 `opts/args` 仅包含 leaf 本地声明项                                                                 |
| run                       | -        | 执行 leaf command 的 action                                                                                                                                                        |

详见 [command.md](./command.md) 的“内建 version 支持判定”“CONTROL SCAN 规则”“`control-run` 规则”与“代表性场景”。

若 user tail（`--` 之前）同时包含 `--help` 与 `--version`，按 `help > version` 处理。

`preset` profile selector 决议为强约束：优先级为 `--preset-profile` > `command.preset.profile` > command-path suffix profile（按 `.` 连接、从长到短）> `defaults.profile` > `default`；selector 支持 `<profile>` 或 `<profile>:<variant>`；未显式 variant 时回退 `profile.defaultVariant`；`--preset-profile` 不可脱离 `--preset-file` 单独使用。

注：`preset` 阶段属于当前规范范围。

术语约定：

1. `route tail argv`：ROUTE 后剩余输入（未做控制语义剥离）。
2. `control tail argv`：CONTROL SCAN 后剩余输入（已剥离控制 token）。
3. `effective tail argv`：PRESET 合并后的最终解析输入。

入口约束：仅允许 `@guanghechen/commander/browser` 与 `@guanghechen/commander/node`，根入口不对外导出。详见 [command.md](./command.md)“运行时入口契约”。

### 1.2 内核化约束

1. 规范层将 `execute(params, mode)` 视为唯一执行语义来源。
2. `run()` 与 `parse()` 是 `execute` 的模式化封装，不允许维护独立语义分支。
3. 9 阶段顺序固定，不允许跳阶段重排。
4. `control-run` 仅在 `mode='run'` 执行；`mode='parse'` 必须跳过该阶段。
5. 任何 short-circuit 必须写入结构化终止状态，不使用分散副作用作为行为事实。
6. 最终设计规范统一收敛在 `command.md` / `hint.md` / `charter.md`，不维护额外并行 spec。

实现提示（non-normative，非规范）：

1. 执行骨架建议由 `command-kernel` 承担（当前实现文件为 `internal/command-kernel.ts`）。
2. 诊断归一化建议由 `diagnostics-engine` 承担。
3. help 输出组装与渲染建议由独立 `help renderer` 承担。
4. preset manifest/profile/variant 解析与 token 约束建议由独立 `preset profile parser` 承担。
5. option token 消费、值转换与 builtin 快照决议建议由独立 `option parser` 承担。
6. 阶段语义入口建议收敛到 `internal/stages/*`；必要 I/O 可通过 helper 承担；`command/command.ts` 以阶段 wiring/私有上下文注入为主，同时承载 Command 对外 API 与配置校验。
7. command orchestrator 的内部辅助建议收敛到 `internal/command/*`（如 action 包装、outcome 处理、preset I/O、definition 校验）；阶段语义统一收敛到 `internal/stages/*`，避免双层 stage 入口。
8. 上述建议仅用于保持实现清晰度，不构成内部文件布局约束。

### 1.3 诊断与来源约束

1. `error/hint` 只能通过统一诊断构建器生成并归一化。
2. `source/preset` 归因应优先来自来源账本（Source Ledger）；当缺少结构化冲突定位信息时，可使用受限回退（例如基于冲突消息与 token 片段匹配）补齐来源归因。
3. issue 结构不变量（如 `issues[0]` 主错误）必须由运行时执行器强制保证。
4. 规范中的 `MUST` 约束应可映射到明确的代码执行点与测试断言。

---

## 2. 选项配置

### 2.1 ICommandOptionConfig

```typescript
interface ICommandOptionConfig<T = unknown> {
  long: string                                        // 长选项名（camelCase，必填）
  short?: string                                      // 短选项（单字符）
  type: 'boolean' | 'number' | 'string'               // 值类型（必填）
  args: 'none' | 'required' | 'optional' | 'variadic' // 参数模式（必填）
  desc: string                                        // 描述文本
  required?: boolean                                  // 是否必需
  default?: T                                         // 默认值
  choices?: T[]                                       // 允许的值列表
  coerce?: (rawValue: string) => T                    // 单值转换
  apply?: (value: T, ctx: ICommandContext) => void    // 应用到 context
}
```

### 2.2 type × args 组合

`type` 和 `args` **必须同时指定**，组合决定选项的默认解析类型：

| type      | args       | 默认解析类型         | 示例                       |
| --------- | ---------- | -------------------- | -------------------------- |
| `boolean` | `none`     | `boolean`            | `--verbose`                |
| `string`  | `required` | `string`             | `--output file`            |
| `string`  | `optional` | `string / undefined` | `--write` / `--write path` |
| `number`  | `required` | `number`             | `--port 8080`              |
| `string`  | `variadic` | `string[]`           | `--files a.txt b.txt`      |
| `number`  | `variadic` | `number[]`           | `--ports 80 443`           |

若配置了 `coerce`：

1. `none/required` 的输出类型为 `T`。
2. `optional` 的输出类型为 `T | undefined`。
3. `variadic` 的输出类型为 `T[]`（元素级 coerce）。

`optional` 约束：

1. 当前仅允许 `type: 'string', args: 'optional'`。
2. 当 token 为裸 `--long` / `-s` 且未消费到值时，解析结果为 `undefined`。
3. 当 token 为 `--long=` 时，解析结果为 `''`（空字符串）。
4. 当 token 为 `--long=<value>` 或 `--long <value>`（`<value>` 非 option token）时，解析结果为该值。
5. 当 option 未出现时，读取该字段同样可能得到 `undefined`；若需区分“未出现”与“显式传入无值”，必须结合 key 存在性判断。

`required` 约束：

1. `required` 仅表示“该 option 必须出现”（presence），不等价于 `args: 'required'`。
2. `required: true` 仅允许与 `args: 'required'` 组合。
3. `required: true` 与 `args: 'optional'` / `args: 'variadic'` 组合属于非法配置（构建期 `ConfigurationError`）。

**非法组合**（构建时报错 `ConfigurationError`）：

| type      | args       | 原因                     |
| --------- | ---------- | ------------------------ |
| `boolean` | `required` | boolean 不接受参数       |
| `boolean` | `optional` | boolean 不接受参数       |
| `boolean` | `variadic` | boolean 不接受参数       |
| `string`  | `none`     | string/number 必须有参数 |
| `number`  | `none`     | string/number 必须有参数 |
| `number`  | `optional` | optional 仅支持 string   |

### 2.3 参数消费规则

resolve 阶段按 `args` 贪婪消费后续 tokens：

| args       | 消费行为                                           |
| ---------- | -------------------------------------------------- |
| `none`     | 不消费参数                                         |
| `required` | 消费一个参数                                       |
| `optional` | 优先消费一个参数；若后续为 option 或不存在则不消费 |
| `variadic` | 持续消费，直到遇到 `-` 开头的 token                |

**`=` 语法**：值内嵌时立刻停止消费，不再贪婪：

```
--files=first.txt a.txt b.txt
  → files: ['first.txt']
  → a.txt, b.txt 作为位置参数
```

### 2.4 optional 的 key 存在性与 default 回退

1. `optional` option 允许“值语义”和“存在语义”同时成立：字段值可为 `undefined`，但 key 仍可能存在。
2. `default` 回退仅在 key 不存在时触发；key 已存在（即使值为 `undefined` / `''`）也不回退。
3. 判定是否显式传入 option，必须使用 key 存在性判断，不能仅比较值是否为 `undefined`。
4. `apply` 触发仍按值语义：值为 `undefined` 时不触发 `apply`，即使 key 存在也不触发。

---

## 3. 命名规范

### 3.1 命名约定

| 场景                        | 格式                       | 示例                         |
| --------------------------- | -------------------------- | ---------------------------- |
| 命令行输入                  | kebab-case（大小写不敏感） | `--log-level`, `--LOG-LEVEL` |
| `ICommandOptionConfig.long` | camelCase                  | `logLevel`                   |
| help / 错误提示             | kebab-case（全小写）       | `--log-level`                |
| opts 对象 / 配置文件        | camelCase                  | `{ logLevel: 'debug' }`      |

### 3.2 ICommandToken

```typescript
type ICommandTokenType = 'long' | 'short' | 'none'

type ICommandTokenSource = 'user' | 'preset'

interface ICommandPresetIssueMeta {
  file?: string
  profile?: string
  variant?: string
  optionKey?: string
}

interface ICommandToken {
  original: string        // 原始输入：--LOG-LEVEL=info, -v, foo.txt
  resolved: string        // 规范化后：--logLevel=info, -v, foo.txt
  name: string            // 选项名：logLevel, v, ''
  type: ICommandTokenType // token 类型
  source: ICommandTokenSource // token 来源：user / preset
  preset?: ICommandPresetIssueMeta // source='preset' 时的来源细节
}
```

| type    | 说明   | name      | 匹配                         |
| ------- | ------ | --------- | ---------------------------- |
| `long`  | 长选项 | camelCase | `ICommandOptionConfig.long`  |
| `short` | 短选项 | 单字符    | `ICommandOptionConfig.short` |
| `none`  | 非选项 | `''`      | 位置参数 / `--` 之后         |

来源约束：

1. `source='user'` 时，`preset` 必须为空。
2. `source='preset'` 时，`preset` 应提供可定位信息（至少 `file/profile/variant` 之一）。
3. PRESET 阶段合并输入后，tokenize 必须继承 segment 来源并写入 token `source/preset`。

注：`args: 'none'` 与 `token.type: 'none'` 语义不同，前者表示选项不接参数，后者表示该 token 不是选项。

### 3.3 转换规则

```typescript
// kebab-case → camelCase
function kebabToCamelCase(s: string): string {
  return s.toLowerCase().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

// camelCase → kebab-case
function camelToKebabCase(s: string): string {
  return s.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}
```

**示例**：

| 输入                | resolved           | name       |
| ------------------- | ------------------ | ---------- |
| `--log-level`       | `--logLevel`       | `logLevel` |
| `--LOG-LEVEL`       | `--logLevel`       | `logLevel` |
| `--log-level=Debug` | `--logLevel=Debug` | `logLevel` |
| `--no-verbose`      | `--verbose=false`  | `verbose`  |

> `=` 后的值保持原样；纯 camelCase 输入（如 `--logLevel`）会转为 `--loglevel`，无法匹配。

### 3.4 格式校验

tokenize 阶段校验长选项格式：

```
普通选项：^--[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
负向选项：^--no-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
```

**校验流程**：

1. 按首个 `=` 分割为 namePart / valuePart
2. 将 namePart 转为小写后再执行格式校验
3. namePart 含 `_` → `InvalidOptionFormat`
4. namePart 为 `--no` 或 `--no-` → `InvalidNegativeOption`
5. `--no-*` 且有 `=` → `NegativeOptionWithValue`
6. 不符合正则 → `InvalidOptionFormat`

```bash
# ✅ 合法
--log-level  --LOG-LEVEL  --log-2-level  --no-verbose  --foo=  --foo=a=b

# ❌ 非法
--log_level       # 使用 '_' 而非 '-'
--log--level      # 连续 '-'
--2fa             # 数字开头
--no  --no-       # 不完整的负向选项
--no-foo=true     # 负向选项不能带值
```

### 3.5 tokenize 边界

| 场景            | 处理                          |
| --------------- | ----------------------------- |
| `--` 之前长选项 | 转小写 → camelCase            |
| `--` 之后       | 不转换、不校验                |
| 选项值          | 不转换                        |
| 短选项          | 不转换、不做 kebab-case 校验  |
| `--no-*`        | 转 camelCase，映射为 `=false` |

---

## 4. 选项语法

### 4.1 支持的语法

| 语法           | 示例                           | 说明                                                             |
| -------------- | ------------------------------ | ---------------------------------------------------------------- |
| 长选项         | `--verbose`                    | boolean                                                          |
| 长选项赋值     | `--output=file`                | 带值                                                             |
| 长选项空格     | `--output file`                | 带值                                                             |
| 可选参数长选项 | `--write` / `--write out.fish` | 裸 `--write` -> `undefined`；`--write=` -> `''`；有值取 filepath |
| 短选项         | `-v`                           | 单字符                                                           |
| 短选项空格     | `-o file`                      | 带值                                                             |
| 短选项组合     | `-abc`                         | 等价 `-a -b -c`                                                  |
| 短选项组合带值 | `-vo file`                     | 等价 `-v -o file`                                                |
| Negative       | `--no-foo`                     | 等价 `--foo=false`                                               |
| End-of-options | `--`                           | 后续全部作为位置参数                                             |

### 4.2 不支持的语法

| 语法               | 示例                  | 建议                     |
| ------------------ | --------------------- | ------------------------ |
| 短选项粘连         | `-ofile`              | 使用 `-o file`           |
| 短选项赋值         | `-o=value`            | 使用 `-o value`          |
| 负数值输入         | `-o -1` / `--long -1` | 使用 `--long=-1`         |
| 短选项负数内联赋值 | `-o=-1`               | 不支持，使用 `--long=-1` |

### 4.3 Negative 选项

为 `type: 'boolean', args: 'none'` 自动生成 `--no-{long}`（`help/version` 除外）：

- 仅 boolean、仅长选项
- `long` 不能以 `no` 开头
- `--no-xxx` 不允许带值，永远解析为 `false`

### 4.4 值覆盖规则

**Last Write Wins**（variadic 除外）：

| args       | 行为     | 示例                                              |
| ---------- | -------- | ------------------------------------------------- |
| `none`     | 后者覆盖 | `--foo --no-foo` → `false`                        |
| `required` | 后者覆盖 | `--name=a --name=b` → `'b'`                       |
| `optional` | 后者覆盖 | `--write out --write` → `undefined`               |
| `variadic` | 追加     | `--file a.txt --file b.txt` → `['a.txt','b.txt']` |

**variadic 详细规则**：

```bash
# 单次出现，贪婪消费
--files a.txt b.txt c.txt    → ['a.txt', 'b.txt', 'c.txt']

# 多次出现，追加
--files a.txt --files b.txt  → ['a.txt', 'b.txt']

# = 语法，只取内嵌值
--files=a.txt b.txt          → ['a.txt']  # b.txt 为位置参数
```

---

## 5. 选项继承

- 子命令**强制继承**祖先链上的所有选项
- 使用 `long` 作为合并 key，子节点可覆盖
- 合并顺序：root → ... → parent → current
- 继承项参与解析与 `apply`，但 `action/parse` 对外暴露的 `opts` 仅包含 leaf 本地声明项

详见 [option.md](./option.md)。

---

## 6. 命令路由

**命令路径必须在选项之前完全确定。**

路由按原始字符串匹配 subcommand name/alias：

```bash
pm start --verbose myapp    # ✅ 路由到 start
pm --verbose start myapp    # ❌ 路由停止于 pm
pm unknown --verbose        # ✅ 路由停止于 pm
pm help start               # ✅ route 停止于 pm（tail: ["help", "start"]）
pm help unknown             # ✅ route 停止于 pm（tail: ["help", "unknown"]）
```

```
for token in argv:
    if token starts with '-':
        break
    if current.hasSubcommand(token):
        current = subcommand
    else:
        break
```

详见 [command.md](./command.md)。

未知子命令语义：

1. route 保持“遇到不命中子命令 token 即停止”的行为，不在 route 阶段抛错。
2. 若 route 停止后的 leaf 存在子命令，且 tail 首 token 为裸 token（非 `help` / 非 option），parse 阶段抛 `UnknownSubcommand`。
3. `UnknownSubcommand` 与 `UnexpectedArgument` 冲突时，优先级固定为 `UnknownSubcommand > UnexpectedArgument`。
4. 若抛 `UnknownSubcommand` 且 leaf 同时不接受位置参数，应追加 `hint issue`：`reason.code='command_does_not_accept_positional_arguments'`（默认渲染文本：`Hint: command "<path>" does not accept positional arguments.`）。
5. 若抛 `UnknownSubcommand` 且存在唯一高置信候选子命令，应追加 `hint issue`：`reason.code='did_you_mean_subcommand'`（默认渲染文本：`Hint: did you mean "<candidate>"?`）。
6. 候选提示判定规则：
   - 候选集合仅包含当前 leaf 的直接子命令 `name`（不包含 aliases）；
   - 候选排序策略由实现决定（可使用编辑距离、前缀匹配或其他等价方法）；
   - 仅当可确定唯一且高置信候选时，输出 `did-you-mean` hint；
   - 若无法确定唯一高置信候选，则不输出该 hint。

---

## 7. 位置参数

- **不继承**，仅在 leaf command 生效
- resolve 阶段第二轮处理：非 `-` 开头的 remaining → argTokens
- `--` 之后内容直接追加到 argTokens（允许 `-` 开头）
- `-` 开头的 remaining 触发 `UnknownOption` 错误
- leaf 未声明任何位置参数却收到裸 token 时，若未命中 `UnknownSubcommand`，抛 `UnexpectedArgument`
- `TooManyArguments` 仅用于“已声明位置参数但传入数量超上限”的场景

---

## 8. 配置约束

### 8.1 构建时

| 约束                     | 说明                                                  |
| ------------------------ | ----------------------------------------------------- |
| `type` + `args` 非法组合 | 见 §2.2                                               |
| `required` + `default`   | 互斥                                                  |
| `boolean` + `required`   | 互斥                                                  |
| `required` + `args`      | 仅允许 `args: 'required'`                             |
| 保留名约束 | 见 [command.md](./command.md)“内置选项”章节 |
| 子命令名/alias 为 `help` | 保留名，不允许                                        |
| 子命令名/alias 冲突      | 不允许（同一 `cmd` 重复注册同一 `name` 视为幂等例外） |
| `long` 非 camelCase      | 不允许                                                |
| `long` 以 `no` 开头      | 不允许                                                |
| `short` 非单字符         | 不允许                                                |
| `short` 冲突             | 不允许                                                |

### 8.2 运行时

| 校验项              | 阶段    | 说明                                         |
| ------------------- | ------- | -------------------------------------------- |
| unknown option      | resolve | 未定义的选项                                 |
| unknown subcommand  | parse   | 存在子命令但命中非法子命令 token             |
| option conflict     | parse   | 互斥选项同时命中（如 completion 的多 shell） |
| required            | parse   | 缺失必需选项                                 |
| type                | parse   | 值类型不匹配（option/argument）              |
| choices             | parse   | 值不在列表中（option/argument）              |
| negative type       | parse   | `--no-xxx` 用于非 boolean                    |
| boolean value       | parse   | boolean 赋值非 true/false                    |
| unexpected argument | parse   | 当前命令不接受位置参数却收到裸 token         |

---

## 9. 错误处理

### 9.1 Exit Code

固定映射（由 CLI adapter 按 `execute` outcome 执行）：

| outcome 条件                                                     | Exit Code |
| ---------------------------------------------------------------- | --------- |
| `kind='parsed'`                                                  | `0`       |
| `kind='terminated'`（`help` / `version`）                        | `0`       |
| `kind='failed'` 且 `error.kind==='ActionFailed'`                 | `1`       |
| `kind='failed'` 且 `error.kind!=='ActionFailed'`（其余全部失败） | `2`       |

说明：Exit Code 仅适用于 `run()` 作为 CLI 入口执行时；`parse()` 仅返回解析结果或抛错，不定义进程退出码。

适配层约束：Exit Code 映射由 CLI adapter 基于 `execute` outcome 执行（详见 [command.md](./command.md)“run/parse 契约”与“control-run 规则”）。

### 9.2 错误格式

```
Error: unknown option "--foo" for command "app sub"
Run "app sub --help" for usage.
```

含 hint 的格式（可选）：

```
Error: unknown subcommand "watc" for command "cli build"
Hint: did you mean "watch"?
Run "cli build --help" for usage.
```

### 9.3 错误类型

| Kind                      | 说明                               |
| ------------------------- | ---------------------------------- |
| `InvalidOptionFormat`     | 选项名格式非法                     |
| `InvalidNegativeOption`   | 负向选项语法错误                   |
| `NegativeOptionWithValue` | 负向选项带值                       |
| `NegativeOptionType`      | 负向选项用于非 boolean             |
| `UnknownOption`           | 未定义的选项                       |
| `UnknownSubcommand`       | 未定义的子命令                     |
| `UnexpectedArgument`      | 非预期位置参数                     |
| `MissingValue`            | 选项缺少值                         |
| `InvalidType`             | 值类型不匹配                       |
| `UnsupportedShortSyntax`  | 不支持的短选项语法                 |
| `OptionConflict`          | 选项冲突（配置期或运行时互斥）     |
| `MissingRequired`         | 缺少必需选项                       |
| `InvalidChoice`           | 值不在 choices 中                  |
| `InvalidBooleanValue`     | boolean 赋值非 true/false          |
| `MissingRequiredArgument` | 缺少必需位置参数                   |
| `TooManyArguments`        | 位置参数过多                       |
| `ConfigurationError`      | 配置错误                           |
| `ActionFailed`            | action 执行失败                    |

补充：`CommanderError.kind` 与 error issue code 保持 1:1 映射（snake_case），例如 `ActionFailed -> action_failed`。

---

## 10. Shell Completion

- 静态脚本生成（非动态补全）
- 支持 Bash / Fish / PowerShell
- `CompletionCommand` 需手动挂载
- 补全列表包含 `--no-{kebab-long}`（仅 `boolean + args:none`，且排除 `help/version`）

详见 [completion.md](./completion.md)。
