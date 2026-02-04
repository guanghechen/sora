# @guanghechen/commander

类型安全的命令行界面构建工具。

## 设计目标

1. **树形结构** — Command 是树节点，子命令层级组合
2. **类型安全** — 完整的 TypeScript 类型支持
3. **选项继承** — 选项沿祖先链继承，子节点可覆盖
4. **解耦设计** — 不隐式访问 `process.argv` / `process.env`
5. **流式 API** — 链式调用构建命令

## 模块结构

```
@guanghechen/commander/
├── command.ts          Command 类
├── option.ts           选项解析
├── completion.ts       Shell 补全生成
├── types.ts            类型定义
└── index.ts            导出
```

## 快速示例

```typescript
import { Command, CompletionCommand } from '@guanghechen/commander'

// 构建命令树
const pm = new Command({ name: 'pm', description: 'Process Manager', version: '1.0.0' })
  .option({ long: 'verbose', short: 'v', type: 'boolean', description: 'Verbose output' })

const start = new Command({ name: 'start', aliases: ['s'], description: 'Start a process' })
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .option({ long: 'detach', short: 'd', type: 'boolean', description: 'Run in background' })
  .action(async ({ ctx, opts, args }) => {
    console.log(`Starting ${args[0]}...`)
    console.log(`Verbose: ${opts.verbose}, Detach: ${opts.detach}`)
  })

const stop = new Command({ name: 'stop', description: 'Stop a process' })
  .argument({ name: 'name', description: 'Process name', kind: 'required' })
  .action(async ({ ctx, opts, args }) => {
    console.log(`Stopping ${args[0]}...`)
  })

pm.subcommand(start)
pm.subcommand(stop)
pm.subcommand(new CompletionCommand(pm))

await pm.run({ argv: process.argv.slice(2), envs: process.env })
```

```bash
# 运行命令
pm start myapp --verbose --detach
pm s myapp -d
pm stop myapp

# 显示帮助
pm --help
pm start --help

# 生成补全脚本
pm completion --bash > ~/.local/share/bash-completion/completions/pm
pm completion --fish > ~/.config/fish/completions/pm.fish
pm completion --pwsh >> $PROFILE
```

## 规范文档

| 文档                             | 说明             |
| -------------------------------- | ---------------- |
| [charter.md](./charter.md)       | 设计宪章         |
| [command.md](./command.md)       | Command 类 API   |
| [option.md](./option.md)         | 选项系统         |
| [completion.md](./completion.md) | Shell 补全       |
