# Design Charter

本文档定义 @guanghechen/commander 的核心设计原则与不可违背的规则。

## 1. 设计目标

| 目标           | 说明                                      |
| -------------- | ----------------------------------------- |
| Tree Structure | Command 是树节点，子命令层级组合          |
| Type Safety    | 完整的 TypeScript 类型支持                |
| Inheritance    | 选项沿祖先链继承，子节点可覆盖            |
| Decoupled      | 不隐式访问 `process.argv` / `process.env` |
| Fluent API     | 链式调用构建命令                          |
| Strict Mode    | 严格解析，unknown option 报错             |

## 2. 选项语法规则

### 2.1 支持的语法

| 语法           | 示例            | 说明                                  |
| -------------- | --------------- | ------------------------------------- |
| 长选项         | `--verbose`     | boolean 选项                          |
| 长选项布尔赋值 | `--foo=true`    | boolean 选项显式赋值（仅 true/false） |
| 长选项赋值     | `--output=file` | 带值选项                              |
| 长选项空格分隔 | `--output file` | 带值选项                              |
| 短选项         | `-v`            | 单字符选项                            |
| 短选项空格分隔 | `-o file`       | 带值选项                              |
| 短选项组合     | `-abc`          | 等价于 `-a -b -c`                     |
| 短选项组合带值 | `-vo file`      | 等价于 `-v -o file`                   |
| Negative 选项  | `--no-foo`      | 等价于 `--foo=false`                  |
| End-of-options | `--`            | 后续 token 全部作为 positional        |

### 2.2 不支持的语法

| 语法                | 示例      | 处理方式                   |
| ------------------- | --------- | -------------------------- |
| 短选项粘连值        | `-ofile`  | 报错，提示使用 `-o file`   |
| 短选项赋值          | `-o=file` | 报错，提示使用 `-o file`   |
| 短选项值以 `-` 开头 | `-o -1`   | 报错，提示使用 `--long=-1` |

### 2.3 短选项组合规则

```
-abc  =>  -a -b -c
-vo file  =>  -v -o file
```

- 组合中**前面的选项**必须是 boolean 类型
- 组合中**最后一个选项**可以是 boolean 或带值类型
- 如果最后一个选项需要 value，后续 token 作为其 value
- 组合中任何选项未定义或类型不符，报错

### 2.4 Negative 选项规则

为所有 boolean 选项自动生成 `--no-{long}` 形式。

| 规则            | 说明                                      |
| --------------- | ----------------------------------------- |
| 自动生成        | boolean 选项自动拥有 `--no-{long}` 形式   |
| 仅长选项        | 不支持短选项形式（无 `-no-x`）            |
| 仅 boolean      | 只为 `type: 'boolean'` 的选项生成         |
| 禁止自定义      | 用户不能定义以 `--no-` 开头的选项         |
| 禁止 `no-` 前缀 | 用户不能定义 `long: 'no-xxx'`，构建时报错 |
| 禁止带值        | `--no-xxx` 不允许带值，永远解析为 `false` |

`--no-xxx` 的解析规则：

- `--no-foo` → `foo = false`
- `--no-foo=true` → 报错，`--no-` 选项不允许带值
- `--no-foo=false` → 报错，`--no-` 选项不允许带值

### 2.5 Boolean 选项赋值规则

boolean 选项支持显式赋值形式 `--flag=value`：

| 语法           | 结果    | 说明                    |
| -------------- | ------- | ----------------------- |
| `--foo`        | `true`  | 标准形式                |
| `--no-foo`     | `false` | Negative 形式           |
| `--foo=true`   | `true`  | 显式赋值                |
| `--foo=false`  | `false` | 显式赋值                |
| `--foo=其他值` | 报错    | 仅接受 `true` / `false` |
| `--foo value`  | `true`  | `value` 作为位置参数    |

注意：`--foo true` 不会将 `true` 作为选项值，因为 boolean 选项不消费后续 token。

## 3. 选项值覆盖规则

**Last Write Wins** — 后出现的值覆盖先出现的值（array 类型除外）。

| 类型     | 行为       | 示例                                     |
| -------- | ---------- | ---------------------------------------- |
| boolean  | 后者覆盖   | `--foo --no-foo` → `false`               |
| boolean  | 后者覆盖   | `--no-foo --foo` → `true`                |
| string   | 后者覆盖   | `--name=a --name=b` → `'b'`              |
| number   | 后者覆盖   | `--count=1 --count=2` → `2`              |
| string[] | **append** | `--include=a --include=b` → `['a', 'b']` |
| number[] | **append** | `--port=80 --port=443` → `[80, 443]`     |

## 4. 选项继承规则

### 4.1 继承机制

- 子命令**强制继承**祖先链上的所有选项
- 使用 `long` 作为合并 key，子节点可覆盖祖先定义
- 合并顺序：root → ... → parent → current（后者覆盖前者）

### 4.2 冲突检测

在**合并后的 options 集合**中检测冲突：

| 冲突类型                     | 处理               |
| ---------------------------- | ------------------ |
| 不同 `long` 共享同一 `short` | 构建时报错         |
| 同 `long` 的覆盖（父/子）    | 允许，视为同一选项 |
| `long` 以 `no-` 开头         | 构建时报错         |

### 4.3 Apply 回调

选项可定义 `apply` 回调，在解析完成后将值同步到 context：

```typescript
apply?: (value: T, ctx: ICommandContext) => void
```

| 规则     | 说明                               |
| -------- | ---------------------------------- |
| 执行时机 | 选项解析完成后、action 执行前      |
| 触发条件 | 仅在解析值非 undefined 时执行      |
| 调用顺序 | 按合并后 options 集合的顺序        |
| 覆盖行为 | 子命令覆盖选项时使用子命令的 apply |
| 幂等性   | apply 应该是幂等的                 |

这样可以在选项定义处集中处理副作用（如设置 log level），而非分散到每个 action。

### 4.5 Coerce 回调

单值转换，在内置解析器的 reduce 之前执行：

```typescript
coerce?: (rawValue: string) => T
```

- 每次出现的单个值调用一次（array 类型逐项调用）
- 先 coerce 转换，再 choices 校验
- 有 resolver 时忽略 coerce

### 4.6 Resolver 回调

完全替代内置解析逻辑：

```typescript
resolver?: (argv: string[]) => { value: T; remaining: string[] }
```

- 有 resolver 时忽略 type、coerce、内置逻辑
- 只能消费本 segment 的 tokens，不得跨 `--`
- resolver 需自行处理 default 值（内置解析器不参与）

适用场景：自定义收集逻辑、可选值选项、多 token 值。

### 4.7 解析优先级

| 场景                  | 解析方式                      |
| --------------------- | ----------------------------- |
| 有 resolver           | resolver（忽略 type、coerce） |
| 有 coerce 无 resolver | 内置解析器 + coerce           |
| 无 coerce 无 resolver | 内置解析器                    |

详见 [option.md](./option.md)。

### 4.4 内置选项

自动挂载，用户可通过同 `long` 名覆盖：

| 选项        | Short | 说明           |
| ----------- | ----- | -------------- |
| `--help`    | `-h`  | 显示帮助并退出 |
| `--version` | `-V`  | 显示版本并退出 |

**覆盖规则**：用户定义同名 `long` 时，内置选项定义与默认行为均被移除，用户需自行在 `apply` 或
`action` 中处理逻辑。

## 5. 命令路由规则

### 5.1 核心原则

**命令路径必须在任何 options 之前完全确定。**

路由从左到右扫描 argv，遇到 `-` 或 `--`
开头的 token 即停止，后续全部视为当前命令的 options/args。这消除了 routing 与 option 定义之间的循环依赖。

```bash
pm start --verbose myapp    # ✅ 正确：先确定命令路径 (pm -> start)，再解析选项
pm --verbose start myapp    # ❌ 错误：遇到 --verbose 时路由停止，start 被视为位置参数
```

### 5.2 路由算法

从 root 开始，从左到右扫描 argv：

1. 遇到 `-` 或 `--` 开头的 token → 停止路由
2. 遇到子命令名/别名 → 切换到该子命令，继续扫描
3. 遇到非子命令的 token → 停止路由
4. 扫描结束 → 当前命令即为目标命令

### 5.3 `--` 处理规则

| 场景              | 行为                                  |
| ----------------- | ------------------------------------- |
| 路由阶段遇到 `--` | 停止路由                              |
| 解析阶段遇到 `--` | 停止选项解析，后续全部作为 args       |
| `--` 本身         | 不进入最终 args                       |
| 需要 literal `--` | 使用 `-- --`（第二个作为 positional） |

注意：由于路由遇到 `-` 即停止，`--` 在路由阶段不会出现在"等待选项值"的上下文中。

## 6. Positional Arguments 规则

### 6.1 不继承

Positional arguments **不继承**，只在定义它的命令上生效。

### 6.2 父命令 arguments

- 子命令存在时，父命令的 arguments 不参与解析
- 父命令的 arguments 只在直接调用父命令时生效

## 7. 配置约束

### 7.1 构建时校验

| 约束                   | 说明                   |
| ---------------------- | ---------------------- |
| `required` + `default` | 不能同时存在，配置错误 |
| `boolean` + `required` | 不能同时存在，配置错误 |
| `long` 以 `no-` 开头   | 不允许，配置错误       |
| 合并后 `short` 冲突    | 不允许，配置错误       |

### 7.2 运行时校验

| 校验项         | 说明                        | 适用范围     |
| -------------- | --------------------------- | ------------ |
| required 检查  | 缺失必需选项时报错          | 所有选项     |
| type 检查      | 值类型不匹配时报错          | 仅内置解析器 |
| choices 检查   | 值不在 choices 列表中时报错 | 所有选项     |
| unknown option | 未定义的选项报错            | 所有选项     |

## 8. 错误处理规则

### 8.1 Exit Code

| 类型        | Exit Code | 说明                     |
| ----------- | --------- | ------------------------ |
| 成功        | 0         | 正常完成                 |
| Action 错误 | 1         | 用户 action 执行失败     |
| 解析错误    | 2         | 选项解析、路由、校验失败 |

### 8.2 错误信息格式

采用 **一行主因 + 一行提示** 的格式：

```
Error: unknown option "--foo" for command "app sub"
Run "app sub --help" for usage.
```

### 8.3 错误类型

| Kind                      | 说明                          |
| ------------------------- | ----------------------------- |
| `UnknownOption`           | 未定义的选项                  |
| `MissingValue`            | 选项缺少必需的值              |
| `InvalidType`             | 值类型不匹配                  |
| `UnsupportedShortSyntax`  | 不支持的短选项语法            |
| `OptionConflict`          | 选项配置冲突                  |
| `MissingRequired`         | 缺少必需选项                  |
| `InvalidChoice`           | 值不在 choices 中             |
| `InvalidBooleanValue`     | boolean 选项赋值非 true/false |
| `MissingRequiredArgument` | 缺少必需的位置参数            |
| `ConfigurationError`      | 配置错误                      |

## 9. Shell Completion 规则

### 9.1 设计原则

- 静态脚本生成，非动态补全
- 支持 Bash / Fish / PowerShell
- CompletionCommand 需手动挂载

### 9.2 Negative 选项补全

- `--no-{long}` 形式应包含在补全列表中
- 与原 boolean 选项使用相同的 description
