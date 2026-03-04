# Shell Completion

静态补全脚本生成器，支持 Bash、Fish、PowerShell。

---

## 类型定义

```typescript
type ICompletionShellType = 'bash' | 'fish' | 'pwsh'

interface ICompletionOptionMeta {
  long: string          // camelCase
  short?: string
  desc: string
  takesValue: boolean   // args !== 'none'
  choices?: string[]
}

interface ICompletionArgumentMeta {
  name: string
  kind: 'required' | 'optional' | 'variadic' | 'some'
  type: 'string' | 'choice'
  choices?: string[] // 仅 type='choice' 时存在
}

interface ICompletionMeta {
  name: string
  desc: string
  aliases: string[]
  options: ICompletionOptionMeta[]
  arguments: ICompletionArgumentMeta[]
  subcommands: ICompletionMeta[]
}
```

`ICompletionArgumentMeta.choices` 生成规则：

- 来源于 `ICommandArgumentConfig.choices`
- 元素统一按 `String(value)` 序列化为 shell 候选值
- 对于 `type: 'choice'`，`choices` 必有值

`ICompletionOptionMeta.choices` 生成规则：

- 来源于 `ICommandOptionConfig.choices`
- 元素统一按 `String(value)` 序列化为 shell 候选值
- 生成脚本时必须按 shell 类型做转义（bash/fish/pwsh 各自遵循本 shell 的转义规则）

---

## CompletionCommand

内置补全子命令，需手动挂载：

```typescript
import { Command } from '@guanghechen/commander/browser'
import { CompletionCommand } from '@guanghechen/commander/node'

const pm = new Command({ name: 'pm', desc: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', args: 'none', desc: 'Verbose' })

pm.subcommand('start', new Command({ desc: 'Start' }))
pm.subcommand('completion', new CompletionCommand(pm))

await pm.run({ argv: process.argv.slice(2), envs: process.env })
```

**CLI 使用**：

```bash
pm completion --bash > ~/.local/share/bash-completion/completions/pm
pm completion --fish > ~/.config/fish/completions/pm.fish
pm completion --pwsh >> $PROFILE
pm completion --fish --write
pm completion --fish --write ~/.config/fish/completions/pm.fish
```

必须且只能指定一个 shell 选项。

shell 选项错误语义：

1. 未指定 shell（`--bash/--fish/--pwsh` 全未命中）时，抛 `MissingRequired`。
2. 同时指定多个 shell 时，抛 `OptionConflict`。
3. 上述两类属于 parse/validation 错误：`parse()` 抛错，`run()` 作为 CLI 入口时按 Exit Code `2` 处理。

`--write` 语义：

1. 长选项：`--write`、`--write=`、`--write <filepath>`、`--write=<filepath>` 均合法。
2. 短选项：仅 `-w` 与 `-w <filepath>` 合法；不支持 `-w=` / `-w=<filepath>` / `-w<filepath>`。
3. `--write`（无 filepath）时，`write = undefined`，视为启用写入模式并写入当前 shell 默认安装路径。
4. `--write=` 时，`write = ''`，同样视为启用写入模式并写入当前 shell 默认安装路径。
5. `--write <filepath>` 或 `--write=<filepath>`（以及 `-w <filepath>`）时，`write = '<filepath>'`，写入指定路径。
6. 未出现 `--write`/`-w` 时，`write` key 不存在（读取值为 `undefined`），输出脚本到 stdout。
7. 写入模式下，若父目录不存在则自动创建。
8. 是否启用写入模式必须按 key 存在性判断（如 `Object.prototype.hasOwnProperty.call(opts, 'write')`），不能仅比较 `opts.write !== undefined`。

---

## Shell 生成器

底层生成器可独立使用：

```typescript
import { BashCompletion, FishCompletion, PwshCompletion } from '@guanghechen/commander/node'

const meta = pm.getCompletionMeta()
const script = new BashCompletion(meta, 'pm').generate()
```

---

## 安装路径

| Shell      | 路径                                                |
| ---------- | --------------------------------------------------- |
| Bash       | `~/.local/share/bash-completion/completions/<name>` |
| Fish       | `~/.config/fish/completions/<name>.fish`            |
| PowerShell | `$PROFILE`                                          |

---

## Negative 选项

对于 `type: 'boolean', args: 'none'` 选项，补全包含：

- `--{kebab-long}`（如 `--verbose`）
- `--no-{kebab-long}`（如 `--no-verbose`）

`long`（camelCase）自动转换为 kebab-case 显示。

---

## Argument Choices 补全

当 leaf command 的当前位置处于位置参数解析槽位，且该参数声明了 `choices` 时，shell 补全必须提供对应候选值。

规则：

1. 候选来源：当前槽位对应的 argument `choices`（按 `String(value)` 输出）。
2. `variadic` / `some` 参数若声明了 `choices`，则每个后续槽位都重复给出同一组候选。
3. `type: 'choice'` 的 argument 因 `choices` 必填，必须具备 choices 自动补全。
4. `type: 'string'` 时不提供 argument 候选。
5. 若当前在 option value 槽位，则优先补全该 option 的 value 候选（若定义了 option `choices`），不提供 argument 候选。
6. 补全优先级：先处理子命令与 option 名补全；当进入 argument 槽位时再给出 argument `choices` 候选。
7. Fish 的 command 上下文条件必须按完整 command chain 生成（每一层一个 `__fish_seen_subcommand_from ...` 且以 `; and` 连接），不能只依赖最后一级子命令名；每层条件应同时覆盖该层 `name + aliases`。
