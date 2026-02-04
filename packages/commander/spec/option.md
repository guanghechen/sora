# 选项系统

选项的定义、继承与解析。

## 类型定义

```typescript
type IOptionType = 'boolean' | 'string' | 'number' | 'string[]' | 'number[]'

interface IOption<T = unknown> {
  /** 长选项（如 'verbose' 对应 --verbose），同时作为合并 key */
  long: string
  /** 短选项（单字符，如 'v' 对应 -v） */
  short?: string
  /** 值类型，默认 'string' */
  type?: IOptionType
  /** 描述文本 */
  description: string
  /** 是否必需（不能与 default 同时使用，不能用于 boolean） */
  required?: boolean
  /** 未提供时的默认值 */
  default?: T
  /** 允许的值列表（用于校验和补全） */
  choices?: T extends (infer U)[] ? U[] : T[]
  /** 单值转换（与 resolver 互斥） */
  coerce?: (rawValue: string) => T extends (infer U)[] ? U : T
  /** 自定义解析器（完全替代内置逻辑，忽略 type/coerce） */
  resolver?: (argv: string[]) => { value: T; remaining: string[] }
  /** 解析完成后的回调，用于将值应用到 context */
  apply?: (value: T, ctx: ICommandContext) => void
}
```

## 解析优先级

| 场景                  | 解析方式                                      |
| --------------------- | --------------------------------------------- |
| 有 resolver           | resolver（忽略 type、coerce、内置逻辑）       |
| 有 coerce 无 resolver | 内置解析器 + coerce                           |
| 无 coerce 无 resolver | 内置解析器                                    |

## 内置解析器

根据 `type` 自动处理值的消费和 reduce：

| type       | 多次出现的行为 | 示例                                      |
| ---------- | -------------- | ----------------------------------------- |
| `boolean`  | Last Write Wins| `--foo --no-foo` → `false`                |
| `string`   | Last Write Wins| `--name=a --name=b` → `'b'`               |
| `number`   | Last Write Wins| `--count=1 --count=2` → `2`               |
| `string[]` | append         | `--include=a --include=b` → `['a', 'b']`  |
| `number[]` | append         | `--port=80 --port=443` → `[80, 443]`      |

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

// 流程：--port=80 --port=443
// 1. coerce("80")  → 80  → append → [80]
// 2. coerce("443") → 443 → append → [80, 443]
```

| 规则             | 说明                                    |
| ---------------- | --------------------------------------- |
| 执行时机         | 解析到选项值后立即调用                  |
| 作用域           | 每次出现的单个值（array 类型逐项调用）  |
| 与 choices 顺序  | 先 coerce 转换，再 choices 校验         |
| 异常处理         | 抛出异常则中止解析并报错                |
| 与 resolver 互斥 | 有 resolver 时忽略 coerce               |

## Resolver 回调

完全替代内置解析逻辑，用于特殊场景：

```typescript
// --header "X-Foo: bar" --header "X-Bar: baz" → { 'X-Foo': 'bar', 'X-Bar': 'baz' }
.option({
  long: 'header',
  resolver: (argv) => {
    const headers: Record<string, string> = {}
    const remaining: string[] = []

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i]
      if (arg === '--header' && i + 1 < argv.length) {
        const [key, val] = argv[i + 1].split(': ')
        headers[key] = val
        i++
      } else if (arg.startsWith('--header=')) {
        const [key, val] = arg.slice(9).split(': ')
        headers[key] = val
      } else {
        remaining.push(arg)
      }
    }

    return { value: headers, remaining }
  },
})
```

适用场景：
- 自定义收集逻辑（如 header 解析为对象）
- 可选值选项（如 `--config` 或 `--config=path`）
- 多 token 值（如 `--point 1 2 3`）

约束：
- 只能消费本命令的 argv，不得跨 `--`
- 有 resolver 时忽略 coerce 和内置解析逻辑
- resolver 需自行处理 default 值（内置解析器不参与）
- 即使有 resolver，仍建议保留 `type` 字段作为 metadata（用于补全和帮助生成）

## Apply 回调

解析完成后将值应用到 context，集中处理副作用：

```typescript
// ✅ 在选项定义处统一处理，而非分散到每个 action
.option({
  long: 'log-level',
  type: 'string',
  choices: ['debug', 'info', 'warn', 'error'],
  default: 'info',
  apply: (value, ctx) => {
    ctx.reporter.setLevel(value)
  },
})
```

| 规则       | 说明                                    |
| ---------- | --------------------------------------- |
| 执行时机   | 选项解析完成后、action 执行前           |
| 触发条件   | 仅在解析值非 undefined 时执行           |
| 调用顺序   | 按合并后 options 集合的顺序             |
| 覆盖行为   | 子命令覆盖选项时使用子命令的 apply      |
| 幂等性     | apply 应该是幂等的                      |

## 继承与合并

子命令**强制继承**祖先链上的所有选项，使用 `long` 作为 key 进行覆盖：

```typescript
const root = new Command({ name: 'cli', description: 'My CLI' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose' })
  .option({ long: 'log-level', type: 'string', description: 'Log level' })

const sub = new Command({ name: 'build', description: 'Build' })
  .option({ long: 'log-level', type: 'string', description: 'Build log level' })  // 覆盖
  .option({ long: 'watch', short: 'w', type: 'boolean', description: 'Watch' })

root.subcommand(sub)
```

执行 `cli build` 时合并后的选项：

| long      | 来源 |
| --------- | ---- |
| verbose   | root |
| log-level | sub  |
| watch     | sub  |

### 冲突检测

| 冲突类型                     | 处理       |
| ---------------------------- | ---------- |
| 不同 `long` 共享同一 `short` | 构建时报错 |
| 同 `long` 的覆盖（父/子）    | 允许       |
| `long` 以 `no-` 开头         | 构建时报错 |

## 校验规则

### 构建时

| 约束                   | 说明         |
| ---------------------- | ------------ |
| `required` + `default` | 不能同时存在 |
| `boolean` + `required` | 不能同时存在 |
| `long` 以 `no-` 开头   | 不允许       |
| 合并后 `short` 冲突    | 不允许       |

### 运行时

| 规则            | 说明                                   | 适用范围           |
| --------------- | -------------------------------------- | ------------------ |
| required 检查   | `required: true` 且值为 undefined 报错 | 所有选项           |
| choices 校验    | 值必须在 choices 列表中                | 所有选项           |
| type 校验       | number 必须解析为有效数字              | 仅内置解析器       |
| boolean 值校验  | `--foo=xxx` 只接受 `true`/`false`      | 仅内置解析器       |
| unknown option  | 未定义的选项报错                       | 所有选项           |

注意：`required` 和 `choices` 校验对 resolver 输出仍然生效。
