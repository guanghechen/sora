# Design Charter

本文档定义 @guanghechen/commander 的核心设计原则与规则。

## 1. 设计目标

| 目标           | 说明                                      |
| -------------- | ----------------------------------------- |
| Tree Structure | Command 是树节点，子命令层级组合          |
| Type Safety    | 完整的 TypeScript 类型支持                |
| Inheritance    | 选项沿祖先链继承，子节点可覆盖            |
| Decoupled      | 不隐式访问 `process.argv` / `process.env` |
| Fluent API     | 链式调用构建命令                          |
| Strict Mode    | 严格解析，unknown option 报错             |

## 2. 选项命名规范

### 2.1 命名约定

| 项目              | 格式                             | 示例                         |
| ----------------- | -------------------------------- | ---------------------------- |
| 命令行输入        | kebab-case（强制，大小写不敏感） | `--log-level`, `--LOG-LEVEL` |
| IOption.long 定义 | camelCase（强制）                | `logLevel`, `verbose`        |
| help/错误显示     | kebab-case（全小写）             | `--log-level`, `--verbose`   |
| 内部处理/配置文件 | camelCase                        | `{ logLevel: 'debug' }`      |

### 2.2 ICommandToken

```typescript
interface ICommandToken {
  /** 原始输入，用于错误提示（如 --LOG-LEVEL） */
  original: string
  /** 规范化后，用于解析匹配（如 --logLevel） */
  resolved: string
}
```

- `original` 和 `resolved` 都包含 `--` 前缀
- 不需要转换的 token（短选项、位置参数、`--` 之后）：`original === resolved`

### 2.3 转换规则

```typescript
// kebab-case → camelCase（用于匹配）
function kebabToCamelCase(str: string): string {
  return str.toLowerCase().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

// camelCase → kebab-case（用于显示）
function camelToKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}
```

**转换示例**：

```
--log-level         →   --logLevel            →   logLevel ✅
--LOG-LEVEL         →   --logLevel            →   logLevel ✅
--log-level=Debug   →   --logLevel=Debug      →   logLevel = "Debug" ✅
--no-log-level      →   --logLevel=false      →   logLevel = false ✅
```

**注意**：`=` 后的值保持原样；不含 `-` 的输入（如 `--logLevel`）转为 `--loglevel`，无法匹配。

### 2.4 格式校验

长选项名必须符合 kebab-case 格式，校验在预处理阶段进行：

**合法格式正则**：

```
普通选项：^--[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
负向选项：^--no-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
```

**校验流程**：

1. 按第一个 `=` 分割为 namePart 和 valuePart
2. namePart 包含 `_` → `InvalidOptionFormat`
3. namePart 是 `--no` 或 `--no-` → `InvalidNegativeOption`
4. namePart 以 `--no-` 开头且包含 `=` → `NegativeOptionWithValue`
5. 不符合正则 → `InvalidOptionFormat`

**示例**：

```bash
# ✅ 合法
--log-level, --LOG-LEVEL, --log-2-level, --verbose, --no-verbose, --foo=, --foo=a=b

# ❌ 非法
--log_level       # use '-' instead of '_'
--log--level      # invalid option format
--2fa             # 数字开头
--no, --no-       # invalid negative option syntax
--no-foo=true     # negative option cannot have value
```

**设计指导**：数字开头的标识符应作为**选项值**使用：

```bash
mycli --auth-method 2fa    # ✅ 推荐
mycli --2fa                # ❌ 不支持
```

### 2.5 预处理边界

| 场景              | 处理方式                       |
| ----------------- | ------------------------------ |
| `--` 之前的长选项 | 转小写后转 camelCase           |
| `--` 之后的内容   | 不转换，不校验                 |
| 选项值            | 不转换                         |
| 短选项            | 不转换，不做 kebab-case 校验   |
| `--no-*` 前缀     | 转 camelCase 后映射为 `=false` |

## 3. 选项语法

### 3.1 支持的语法

| 语法           | 示例            | 说明                      |
| -------------- | --------------- | ------------------------- |
| 长选项         | `--verbose`     | boolean 选项              |
| 长选项赋值     | `--foo=true`    | boolean 仅接受 true/false |
| 长选项赋值     | `--output=file` | 带值选项                  |
| 长选项空格     | `--output file` | 带值选项                  |
| 短选项         | `-v`            | 单字符选项                |
| 短选项空格     | `-o file`       | 带值选项                  |
| 短选项组合     | `-abc`          | 等价于 `-a -b -c`         |
| 短选项组合带值 | `-vo file`      | 等价于 `-v -o file`       |
| Negative       | `--no-foo`      | 等价于 `--foo=false`      |
| End-of-options | `--`            | 后续全部作为 positional   |

### 3.2 不支持的语法

| 语法       | 示例      | 说明                 |
| ---------- | --------- | -------------------- |
| 短选项粘连 | `-ofile`  | 提示使用 `-o file`   |
| 短选项赋值 | `-o=file` | 提示使用 `-o file`   |
| 短选项负数 | `-o -1`   | 提示使用 `--long=-1` |

### 3.3 Negative 选项

为 boolean 选项自动生成 `--no-{long}` 形式：

- 仅 boolean 类型、仅长选项
- 用户不能定义 `--no-*` 或 `long: 'noXxx'`
- `--no-xxx` 不允许带值，永远解析为 `false`

### 3.4 值覆盖规则

**Last Write Wins**（array 类型 append）：

| 类型     | 行为     | 示例                                     |
| -------- | -------- | ---------------------------------------- |
| boolean  | 后者覆盖 | `--foo --no-foo` → `false`               |
| string   | 后者覆盖 | `--name=a --name=b` → `b`                |
| number   | 后者覆盖 | `--count=1 --count=2` → `2`              |
| string[] | append   | `--include=a --include=b` → `['a', 'b']` |
| number[] | append   | `--port=80 --port=443` → `[80, 443]`     |

## 4. 选项继承

- 子命令**强制继承**祖先链上的所有选项
- 使用 `long` 作为合并 key，子节点可覆盖
- 合并顺序：root → ... → parent → current

详见 [option.md](./option.md)。

## 5. 命令路由

**命令路径必须在任何选项之前完全确定。**

从左到右扫描 argv，遇到 `-` 或 `--` 开头的 token 即停止路由：

```bash
pm start --verbose myapp    # ✅ 先确定 pm -> start
pm --verbose start myapp    # ❌ start 被视为位置参数
```

**路由算法**：

1. 遇到 `-` 或 `--` 开头 → 停止
2. 遇到子命令名/别名 → 切换，继续扫描
3. 遇到非子命令 token → 停止
4. 扫描结束 → 当前命令为目标

详见 [command.md](./command.md)。

## 6. Positional Arguments

- **不继承**，只在定义它的命令上生效
- 子命令存在时，父命令的 arguments 不参与解析

## 7. 配置约束

### 7.1 构建时

| 约束                   | 说明         |
| ---------------------- | ------------ |
| `required` + `default` | 不能同时存在 |
| `boolean` + `required` | 不能同时存在 |
| `long` 不是 camelCase  | 不允许       |
| `long` 以 `no` 开头    | 不允许       |
| 合并后 `short` 冲突    | 不允许       |

### 7.2 运行时

| 校验项         | 说明                             |
| -------------- | -------------------------------- |
| required       | 缺失必需选项报错                 |
| type           | 值类型不匹配报错（仅内置解析器） |
| choices        | 值不在列表中报错                 |
| unknown option | 未定义的选项报错                 |
| negative type  | `--no-xxx` 用于非 boolean 报错   |
| boolean value  | boolean 赋值非 true/false 报错   |

## 8. 错误处理

### 8.1 Exit Code

| 类型        | Code | 说明                 |
| ----------- | ---- | -------------------- |
| 成功        | 0    | 正常完成             |
| Action 错误 | 1    | action 执行失败      |
| 解析错误    | 2    | 解析、路由、校验失败 |

### 8.2 错误格式

```
Error: unknown option "--foo" for command "app sub"
Run "app sub --help" for usage.
```

### 8.3 错误类型

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
| `ConfigurationError`      | 配置错误                  |

## 9. Shell Completion

- 静态脚本生成，非动态补全
- 支持 Bash / Fish / PowerShell
- CompletionCommand 需手动挂载
- `--no-{kebab-long}` 包含在补全列表中

详见 [completion.md](./completion.md)。
