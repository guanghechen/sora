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

interface ICompletionMeta {
  name: string
  desc: string
  aliases: string[]
  options: ICompletionOptionMeta[]
  subcommands: ICompletionMeta[]
}
```

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
```

必须且只能指定一个 shell 选项。

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
