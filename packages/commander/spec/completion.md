# Shell 补全生成器

静态补全脚本生成器，支持 Bash、Fish、PowerShell。

## 类型定义

```typescript
type IShellType = 'bash' | 'fish' | 'pwsh'

interface ICompletionOptionMeta {
  long: string          // camelCase，与 IOption.long 一致
  short?: string
  description: string
  takesValue: boolean
  choices?: string[]
}

interface ICompletionMeta {
  name: string
  description: string
  aliases: string[]
  options: ICompletionOptionMeta[]
  subcommands: ICompletionMeta[]
}
```

## CompletionCommand

内置补全子命令，**需手动挂载**：

```typescript
import { Command, CompletionCommand } from '@guanghechen/commander'

const pm = new Command({ name: 'pm', description: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose' })

pm.subcommand('start', new Command({ description: 'Start' }))
pm.subcommand('completion', new CompletionCommand(pm))

await pm.run({ argv: process.argv.slice(2), envs: process.env })
```

### CLI 使用

```bash
pm completion --bash > ~/.local/share/bash-completion/completions/pm
pm completion --fish > ~/.config/fish/completions/pm.fish
pm completion --pwsh >> $PROFILE
```

必须且只能指定一个 shell 选项：`--bash`、`--fish`、`--pwsh`。

## Shell 生成器

底层生成器可独立使用：

```typescript
import { BashCompletion, FishCompletion, PwshCompletion } from '@guanghechen/commander'

const meta = pm.getCompletionMeta()
const script = new BashCompletion(meta, 'pm').generate()
```

## 安装路径

| Shell      | 路径                                                |
| ---------- | --------------------------------------------------- |
| Bash       | `~/.local/share/bash-completion/completions/<name>` |
| Fish       | `~/.config/fish/completions/<name>.fish`            |
| PowerShell | `$PROFILE`                                          |

## Negative 选项补全

对于 boolean 选项，补全包含：

- `--{kebab-long}`（如 `--log-level`）
- `--no-{kebab-long}`（如 `--no-log-level`）

`ICompletionOptionMeta.long`（camelCase）会自动转换为 kebab-case 显示。
