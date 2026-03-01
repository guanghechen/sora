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
| Fluent API     | 链式调用构建命令                          |
| Strict Mode    | 严格解析，unknown option 报错             |

### 1.1 执行流程

```
user argv → route → control-scan(run/parse) → run-control(run only) → preset → tokenize → resolve → parse → run
```

| 阶段                      | 方向     | 说明                                                                                                         |
| ------------------------  | -------- | ------------------------------------------------------------------------------------------------------------ |
| route                     | 自顶向下 | 基于 user argv 匹配 subcommand（name/alias），不改写 argv                                                    |
| control-scan（run/parse） | -        | 在 user tail（`--` 之前）识别控制语义：`--help` 按 token 扫描，`--version` 需 `supportsBuiltinVersion(leaf)`，`help` 仅 tail 首 token 生效，并写入 `ctx.controls` 后剥离控制 token |
| run-control（仅 run）     | -        | 依据 `ctx.controls` 执行 short-circuit，优先级 `help > version`                                              |
| preset（拟议）            | -        | 加载 `--preset-opts` / `--preset-envs` 并合并输入；preset 文件禁止 `--help/help/--version` 控制项            |
| tokenize                  | -        | effective tail argv → `ICommandToken[]`（格式校验）                                                          |
| resolve                   | 自底向上 | 每个 Command 消费自己的 tokens                                                                               |
| parse                     | 自顶向下 | tokens → opts，调用 apply 更新 ctx；对外仅暴露 leaf 本地声明的 `opts/args`                                   |
| run                       | -        | 执行 leaf command 的 action                                                                                  |

详见 [command.md](./command.md) 中“内建 version 支持判定（拟议）”“CONTROL SCAN 规则（拟议）”“RUN CONTROL 规则（拟议）”与“支持矩阵（代表性场景）”。

若 user tail（`--` 之前）同时包含 `--help` 与 `--version`，按 `help > version` 优先级处理。

说明：`preset` 阶段属于当前规范与实现的一部分。

术语约定：

1. `route tail argv`：ROUTE 后剩余输入（未做控制语义剥离）。
2. `control tail argv`：CONTROL SCAN 后剩余输入（已剥离控制 token）。
3. `effective tail argv`：PRESET 合并后的最终解析输入。

---

## 2. 选项配置

### 2.1 ICommandOptionConfig

```typescript
interface ICommandOptionConfig<T = unknown> {
  long: string                                      // 长选项名（camelCase，必填）
  short?: string                                    // 短选项（单字符）
  type: 'boolean' | 'number' | 'string'             // 值类型（必填）
  args: 'none' | 'required' | 'variadic'            // 参数模式（必填）
  desc: string                                      // 描述文本
  required?: boolean                                // 是否必需
  default?: T                                       // 默认值
  choices?: T[]                                     // 允许的值列表
  coerce?: (rawValue: string) => T                  // 单值转换
  apply?: (value: T, ctx: ICommandContext) => void  // 应用到 context
}
```

### 2.2 type × args 组合

`type` 和 `args` **必须同时指定**，组合决定选项的默认解析类型：

| type      | args       | 默认解析类型 | 示例                  |
| --------- | ---------- | ------------ | --------------------- |
| `boolean` | `none`     | `boolean`    | `--verbose`           |
| `string`  | `required` | `string`     | `--output file`       |
| `number`  | `required` | `number`     | `--port 8080`         |
| `string`  | `variadic` | `string[]`   | `--files a.txt b.txt` |
| `number`  | `variadic` | `number[]`   | `--ports 80 443`      |

若配置了 `coerce`，`none/required` 的输出类型为 `T`，`variadic` 的输出类型为 `T[]`（元素级 coerce）。

**非法组合**（构建时报错 `ConfigurationError`）：

| type      | args       | 原因                     |
| --------- | ---------- | ------------------------ |
| `boolean` | `required` | boolean 不接受参数       |
| `boolean` | `variadic` | boolean 不接受参数       |
| `string`  | `none`     | string/number 必须有参数 |
| `number`  | `none`     | string/number 必须有参数 |

### 2.3 参数消费规则

resolve 阶段按 `args` 贪婪消费后续 tokens：

| args       | 消费行为                            |
| ---------- | ----------------------------------- |
| `none`     | 不消费参数                          |
| `required` | 消费一个参数                        |
| `variadic` | 持续消费，直到遇到 `-` 开头的 token |

**`=` 语法**：值内嵌时立刻停止消费，不再贪婪：

```
--files=first.txt a.txt b.txt
  → files: ['first.txt']
  → a.txt, b.txt 作为位置参数
```

---

## 3. 命名规范

### 3.1 命名约定

| 场景                        | 格式                        | 示例                         |
| --------------------------- | --------------------------- | ---------------------------- |
| 命令行输入                  | kebab-case（大小写不敏感）  | `--log-level`, `--LOG-LEVEL` |
| `ICommandOptionConfig.long` | camelCase                   | `logLevel`                   |
| help / 错误提示             | kebab-case（全小写）        | `--log-level`                |
| opts 对象 / 配置文件        | camelCase                   | `{ logLevel: 'debug' }`      |

### 3.2 ICommandToken

```typescript
type ICommandTokenType = 'long' | 'short' | 'none'

interface ICommandToken {
  original: string        // 原始输入：--LOG-LEVEL=info, -v, foo.txt
  resolved: string        // 规范化后：--logLevel=info, -v, foo.txt
  name: string            // 选项名：logLevel, v, ''
  type: ICommandTokenType // token 类型
}
```

| type    | 说明     | name      | 匹配                         |
| ------- | -------- | --------- | ---------------------------- |
| `long`  | 长选项   | camelCase | `ICommandOptionConfig.long`  |
| `short` | 短选项   | 单字符    | `ICommandOptionConfig.short` |
| `none`  | 非选项   | `''`      | 位置参数 / `--` 之后         |

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

| 输入                | resolved            | name       |
| ------------------- | ------------------- | ---------- |
| `--log-level`       | `--logLevel`        | `logLevel` |
| `--LOG-LEVEL`       | `--logLevel`        | `logLevel` |
| `--log-level=Debug` | `--logLevel=Debug`  | `logLevel` |
| `--no-verbose`      | `--verbose=false`   | `verbose`  |

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

| 场景              | 处理                          |
| ----------------- | ----------------------------- |
| `--` 之前长选项   | 转小写 → camelCase            |
| `--` 之后         | 不转换、不校验                |
| 选项值            | 不转换                        |
| 短选项            | 不转换、不做 kebab-case 校验  |
| `--no-*`          | 转 camelCase，映射为 `=false` |

---

## 4. 选项语法

### 4.1 支持的语法

| 语法           | 示例            | 说明                      |
| -------------- | --------------- | ------------------------- |
| 长选项         | `--verbose`     | boolean                   |
| 长选项赋值     | `--output=file` | 带值                      |
| 长选项空格     | `--output file` | 带值                      |
| 短选项         | `-v`            | 单字符                    |
| 短选项空格     | `-o file`       | 带值                      |
| 短选项组合     | `-abc`          | 等价 `-a -b -c`           |
| 短选项组合带值 | `-vo file`      | 等价 `-v -o file`         |
| Negative       | `--no-foo`      | 等价 `--foo=false`        |
| End-of-options | `--`            | 后续全部作为位置参数      |

### 4.2 不支持的语法

| 语法       | 示例      | 建议                             |
| ---------- | --------- | -------------------------------- |
| 短选项粘连 | `-ofile`  | 使用 `-o file`                   |
| 短选项赋值 | `-o=file` | 使用 `-o file`                   |
| 负数值输入 | `-o -1` / `--long -1` | 使用 `--long=-1` |

### 4.3 Negative 选项

为 `type: 'boolean', args: 'none'` 自动生成 `--no-{long}`：

- 仅 boolean、仅长选项
- `long` 不能以 `no` 开头
- `--no-xxx` 不允许带值，永远解析为 `false`

### 4.4 值覆盖规则

**Last Write Wins**（variadic 除外）：

| args       | 行为     | 示例                                              |
| ---------- | -------- | ------------------------------------------------- |
| `none`     | 后者覆盖 | `--foo --no-foo` → `false`                        |
| `required` | 后者覆盖 | `--name=a --name=b` → `'b'`                       |
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

---

## 7. 位置参数

- **不继承**，仅在 leaf command 生效
- resolve 阶段第二轮处理：非 `-` 开头的 remaining → argTokens
- `--` 之后内容直接追加到 argTokens（允许 `-` 开头）
- `-` 开头的 remaining 触发 `UnknownOption` 错误

---

## 8. 配置约束

### 8.1 构建时

| 约束                     | 说明           |
| ------------------------ | -------------- |
| `type` + `args` 非法组合 | 见 §2.2        |
| `required` + `default`   | 互斥           |
| `boolean` + `required`   | 互斥           |
| `long` 为 `help/version` | 保留名，不允许 |
| 子命令名/alias 为 `help` | 保留名，不允许 |
| `long` 非 camelCase      | 不允许         |
| `long` 以 `no` 开头      | 不允许         |
| `short` 冲突             | 不允许         |

### 8.2 运行时

| 校验项          | 阶段    | 说明                      |
| --------------- | ------- | ------------------------- |
| unknown option  | resolve | 未定义的选项              |
| required        | parse   | 缺失必需选项              |
| type            | parse   | 值类型不匹配              |
| choices         | parse   | 值不在列表中              |
| negative type   | parse   | `--no-xxx` 用于非 boolean |
| boolean value   | parse   | boolean 赋值非 true/false |

---

## 9. 错误处理

### 9.1 Exit Code

| Code | 说明               |
| ---- | ------------------ |
| 0    | 成功               |
| 1    | action 执行失败    |
| 2    | 解析 / 校验失败    |

说明：Exit Code 仅适用于 `run()` 作为 CLI 入口执行时；`parse()` 仅返回解析结果或抛错，不定义进程退出码。

### 9.2 错误格式

```
Error: unknown option "--foo" for command "app sub"
Run "app sub --help" for usage.
```

### 9.3 错误类型

| Kind                      | 说明                      |
| ------------------------- | ------------------------- |
| `InvalidOptionFormat`     | 选项名格式非法            |
| `InvalidNegativeOption`   | 负向选项语法错误          |
| `NegativeOptionWithValue` | 负向选项带值              |
| `NegativeOptionType`      | 负向选项用于非 boolean    |
| `UnknownOption`           | 未定义的选项              |
| `MissingValue`            | 选项缺少值                |
| `InvalidType`             | 值类型不匹配              |
| `UnsupportedShortSyntax`  | 不支持的短选项语法        |
| `OptionConflict`          | 选项配置冲突              |
| `MissingRequired`         | 缺少必需选项              |
| `InvalidChoice`           | 值不在 choices 中         |
| `InvalidBooleanValue`     | boolean 赋值非 true/false |
| `MissingRequiredArgument` | 缺少必需位置参数          |
| `TooManyArguments`        | 位置参数过多              |
| `ConfigurationError`      | 配置错误                  |

---

## 10. Shell Completion

- 静态脚本生成（非动态补全）
- 支持 Bash / Fish / PowerShell
- `CompletionCommand` 需手动挂载
- 补全列表包含 `--no-{kebab-long}`

详见 [completion.md](./completion.md)。
