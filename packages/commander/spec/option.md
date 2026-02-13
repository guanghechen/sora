# 选项系统

选项的定义、继承与解析。

---

## 命名规范

| 场景                        | 格式                     | 示例           |
| --------------------------- | ------------------------ | -------------- |
| `ICommandOptionConfig.long` | camelCase                | `logLevel`     |
| 命令行输入                  | kebab-case（大小写不敏感）| `--log-level`  |
| help / 错误提示             | kebab-case（全小写）     | `--log-level`  |

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
  desc: string             // 描述文本
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
```

---

## type × args 组合

`type` 和 `args` **必须同时指定**，组合决定最终类型：

| type      | args       | 最终类型   | 示例                  |
| --------- | ---------- | ---------- | --------------------- |
| `boolean` | `none`     | `boolean`  | `--verbose`           |
| `string`  | `required` | `string`   | `--output file`       |
| `number`  | `required` | `number`   | `--port 8080`         |
| `string`  | `variadic` | `string[]` | `--files a.txt b.txt` |
| `number`  | `variadic` | `number[]` | `--ports 80 443`      |

**非法组合**（构建时报错）：

| type      | args       | 原因                     |
| --------- | ---------- | ------------------------ |
| `boolean` | `required` | boolean 不接受参数       |
| `boolean` | `variadic` | boolean 不接受参数       |
| `string`  | `none`     | string/number 必须有参数 |
| `number`  | `none`     | string/number 必须有参数 |

---

## 参数消费规则

resolve 阶段按 `args` 贪婪消费后续 tokens：

| args       | 消费行为                            |
| ---------- | ----------------------------------- |
| `none`     | 不消费参数                          |
| `required` | 消费一个参数                        |
| `variadic` | 持续消费，直到遇到 `-` 开头的 token |

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

| 规则       | 说明                              |
| ---------- | --------------------------------- |
| 执行时机   | 解析到选项值后立即调用            |
| 作用域     | 每个值单独调用（variadic 逐项）   |
| 顺序       | 先 coerce，再 choices 校验        |
| 异常       | 抛出异常则中止解析                |

---

## Apply

parse 阶段将解析后的值应用到 context：

```typescript
.option({
  long: 'logLevel',
  type: 'string',
  args: 'required',
  desc: 'Log level',
  choices: ['debug', 'info', 'warn', 'error'],
  default: 'info',
  apply: (value, ctx) => {
    ctx.reporter.setLevel(value)
  },
})
```

| 规则     | 说明                                    |
| -------- | --------------------------------------- |
| 执行时机 | parse 阶段，tokens → opts 之后          |
| 执行顺序 | 自顶向下（root → leaf）                 |
| 触发条件 | 仅在值非 undefined 时执行               |
| 覆盖行为 | 子命令覆盖选项时使用子命令的 apply      |

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

## 校验规则

详见 [charter.md](./charter.md) §8。

**构建时**：

- `type` + `args` 非法组合
- `required` + `default` 互斥
- `boolean` + `required` 互斥
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

短选项无法接受负数值：

```bash
mycli -n -1        # ❌ -1 被识别为选项
mycli --number=-1  # ✅ 长选项 = 语法
mycli --number -1  # ✅ 长选项空格语法
```
