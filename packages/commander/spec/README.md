# @guanghechen/commander

类型安全的命令行界面构建工具。

---

## 设计目标

| 目标       | 说明                                      |
| ---------- | ----------------------------------------- |
| 树形结构   | Command 是树节点，子命令层级组合          |
| 类型安全   | 完整的 TypeScript 类型支持                |
| 选项继承   | 选项沿祖先链继承，子节点可覆盖            |
| 解耦设计   | 不隐式访问 `process.argv` / `process.env` |
| 流式 API   | 链式调用构建命令                          |

---

## 快速示例

```typescript
import { Command, CompletionCommand } from '@guanghechen/commander'

const pm = new Command({ name: 'pm', description: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', args: 'none', description: 'Verbose' })

const start = new Command({ description: 'Start a process' })
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .option({ long: 'detach', short: 'd', type: 'boolean', args: 'none', description: 'Background' })
  .action(async ({ opts, args }) => {
    console.log(`Starting ${args.name}, verbose: ${opts.verbose}, detach: ${opts.detach}`)
  })

pm.subcommand('start', start).subcommand('s', start)
pm.subcommand('completion', new CompletionCommand(pm))

await pm.run({ argv: process.argv.slice(2), envs: process.env })
```

```bash
pm start myapp --verbose --detach
pm s myapp -d
pm --help
pm completion --bash > ~/.local/share/bash-completion/completions/pm
```

---

## 规范文档

| 文档                             | 说明           |
| -------------------------------- | -------------- |
| [charter.md](./charter.md)       | 设计规范       |
| [command.md](./command.md)       | Command API    |
| [option.md](./option.md)         | 选项系统       |
| [completion.md](./completion.md) | Shell 补全     |
