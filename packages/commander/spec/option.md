# 选项系统

选项的定义、继承与解析。

## 命名规范

- **IOption.long**：camelCase（如 `logLevel`）
- **命令行输入**：kebab-case（如 `--log-level`），大小写不敏感
- **help/错误显示**：kebab-case（全小写）

详见 [charter.md](./charter.md) 第 2 节。

## 类型定义

```typescript
type IOptionType = 'boolean' | 'string' | 'number' | 'string[]' | 'number[]'

interface ICommandToken {
  /** 原始输入（如 --LOG-LEVEL） */
  original: string
  /** 规范化后（如 --logLevel） */
  resolved: string
}

interface IOption<T = unknown> {
  /** 长选项（camelCase），同时作为合并 key */
  long: string
  /** 短选项（单字符） */
  short?: string
  /** 值类型，默认 'string' */
  type?: IOptionType
  /** 描述文本 */
  description: string
  /** 是否必需（不能与 default 同时使用，不能用于 boolean） */
  required?: boolean
  /** 默认值 */
  default?: T
  /** 允许的值列表 */
  choices?: T extends (infer U)[] ? U[] : T[]
  /** 单值转换（与 resolver 互斥） */
  coerce?: (rawValue: string) => T extends (infer U)[] ? U : T
  /** 自定义解析器（完全替代内置逻辑） */
  resolver?: (tokens: ICommandToken[]) => { value: T; remaining: ICommandToken[] }
  /** 解析完成后的回调 */
  apply?: (value: T, ctx: ICommandContext) => void
}
```

## 解析优先级

| 场景                  | 解析方式                     |
| --------------------- | ---------------------------- |
| 有 resolver           | resolver（忽略 type/coerce） |
| 有 coerce 无 resolver | 内置解析器 + coerce          |
| 无 coerce 无 resolver | 内置解析器                   |

## 内置解析器

| type       | 多次出现行为    | 示例                                     |
| ---------- | --------------- | ---------------------------------------- |
| `boolean`  | Last Write Wins | `--foo --no-foo` → `false`               |
| `string`   | Last Write Wins | `--name=a --name=b` → `'b'`              |
| `number`   | Last Write Wins | `--count=1 --count=2` → `2`              |
| `string[]` | append          | `--include=a --include=b` → `['a', 'b']` |
| `number[]` | append          | `--port=80 --port=443` → `[80, 443]`     |

## Coerce 回调

单值转换，在 reduce 之前执行：

```typescript
.option({
  long: 'port',
  type: 'number[]',
  coerce: (v) => {
    const n = parseInt(v, 10)
    if (n < 0 || n > 65535) throw new Error('Invalid port')
    return n
  },
})
// --port=80 --port=443 → coerce 逐项调用 → [80, 443]
```

| 规则             | 说明                           |
| ---------------- | ------------------------------ |
| 执行时机         | 解析到选项值后立即调用         |
| 作用域           | 每次出现的单个值（array 逐项） |
| 与 choices 顺序  | 先 coerce，再 choices 校验     |
| 异常处理         | 抛出异常则中止解析             |
| 与 resolver 互斥 | 有 resolver 时忽略             |

## Resolver 回调

完全替代内置解析逻辑：

```typescript
// --header "X-Foo: bar" --header "X-Bar: baz" → { 'X-Foo': 'bar', 'X-Bar': 'baz' }
.option({
  long: 'header',
  resolver: (tokens) => {
    const headers: Record<string, string> = {}
    const remaining: ICommandToken[] = []
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (token.resolved === '--header' && i + 1 < tokens.length) {
        const [key, val] = tokens[i + 1].original.split(': ')
        headers[key] = val
        i++
      } else if (token.resolved.startsWith('--header=')) {
        const eqIndex = token.original.indexOf('=')
        const [key, val] = token.original.slice(eqIndex + 1).split(': ')
        headers[key] = val
      } else {
        remaining.push(token)
      }
    }
    return { value: headers, remaining }
  },
})
```

适用场景：自定义收集逻辑、可选值选项、多 token 值。

约束：

- 只能消费本命令的 tokens，不得跨 `--`
- 有 resolver 时忽略 coerce 和内置逻辑
- resolver 需自行处理 default 值
- 建议保留 `type` 字段作为 metadata（用于补全和帮助）

## Apply 回调

解析完成后将值应用到 context：

```typescript
.option({
  long: 'logLevel',
  type: 'string',
  choices: ['debug', 'info', 'warn', 'error'],
  default: 'info',
  apply: (value, ctx) => {
    ctx.reporter.setLevel(value)
  },
})
```

| 规则     | 说明                               |
| -------- | ---------------------------------- |
| 执行时机 | 选项解析完成后、action 执行前      |
| 触发条件 | 仅在解析值非 undefined 时执行      |
| 调用顺序 | 按合并后 options 集合的顺序        |
| 覆盖行为 | 子命令覆盖选项时使用子命令的 apply |

## 继承与合并

子命令**强制继承**祖先链上的所有选项，使用 `long` 作为 key 进行覆盖。

```typescript
const root = new Command({ name: 'cli', description: 'My CLI' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose' })
  .option({ long: 'logLevel', type: 'string', description: 'Log level' })

const sub = new Command({ description: 'Build' })
  .option({ long: 'logLevel', type: 'string', description: 'Build log level' })  // 覆盖
  .option({ long: 'watch', short: 'w', type: 'boolean', description: 'Watch' })

root.subcommand('build', sub)
```

执行 `cli build --log-level debug` 时合并后的选项：

| long     | 来源 |
| -------- | ---- |
| verbose  | root |
| logLevel | sub  |
| watch    | sub  |

`long` 是唯一身份标识，`short` 仅是 alias。只有覆盖同名 `long` 时才允许修改 `short`。

## 校验规则

详见 [charter.md](./charter.md) 第 8 节。

**构建时**：`required` + `default` 互斥、`boolean` + `required` 互斥、`long` 必须 camelCase 且不能以
`no` 开头、`short` 不能冲突。

**运行时**：required 检查、choices 校验、type 校验（仅内置解析器）、boolean 值校验、negative
type 检查（`--no-xxx` 仅用于 boolean）、unknown option 报错。

## 已知限制

短选项语法 `-n <value>` 无法接受负数值：

```bash
mycli -n -1        # ❌ -1 被识别为选项
mycli --number -1  # ✅ 长选项支持负数值
```
