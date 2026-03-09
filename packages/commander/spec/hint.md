# Hint 设计

本文档定义 `@guanghechen/commander` 的诊断模型：将 `error` 与 `hint` 统一为结构化 `issue`，并提供可追踪的来源路径。

---

## 目标

1. 消除模糊错误提示，避免仅靠字符串猜测来源。
2. 明确“在哪个阶段发现错误”和“错误根因来自哪里”。
3. 在 `source.primary='preset'` 时，携带可定位的 `preset` 细节（`file/profile/variant`）。
4. 支持稳定渲染（CLI 文本）与后续程序化消费（JSON/结构化对象）。

## 非目标

1. 不改变现有解析语义与阶段顺序。
2. 不在 v1 引入可插拔诊断插件机制。

## 规范分层

1. `MUST`：不满足即视为实现缺陷，必须由运行时执行点与测试共同保障。
2. `SHOULD`：推荐约束，允许在具备明确理由时调整，但需在 spec 中记录决策。

---

## 阶段定义

```ts
export type ICommandStage =
  | 'route'            // 0
  | 'control-scan'     // 1
  | 'control-run'      // 2
  | 'preset'           // 3
  | 'tokenize'         // 4
  | 'builtin-resolve'  // 5
  | 'resolve'          // 6
  | 'parse'            // 7
  | 'run'              // 8
```

---

## 统一 Issue 模型

```ts
export type ICommandIssueKind = 'error' | 'hint'

export type ICommandIssueSourceKind = 'user' | 'preset'

export interface ICommandIssueSourceAttribution {
  primary?: ICommandIssueSourceKind
  related?: ICommandIssueSourceKind[]
}

export type ICommandIssueScope =
  | 'control'
  | 'preset'
  | 'option'
  | 'argument'
  | 'command'
  | 'runtime'
  | 'action'

export type ICommandErrorIssueCode =
  | 'invalid_option_format'
  | 'invalid_negative_option'
  | 'negative_option_with_value'
  | 'negative_option_type'
  | 'unknown_option'
  | 'unknown_subcommand'
  | 'unexpected_argument'
  | 'missing_value'
  | 'invalid_type'
  | 'unsupported_short_syntax'
  | 'option_conflict'
  | 'missing_required'
  | 'invalid_choice'
  | 'invalid_boolean_value'
  | 'missing_required_argument'
  | 'too_many_arguments'
  | 'configuration_error'
  | 'action_failed'

export type ICommandHintIssueCode =
  | 'preset_token_injected'
  | 'mixed_source_conflict'
  | 'did_you_mean_subcommand'
  | 'command_does_not_accept_positional_arguments'

export type ICommandIssueCode = ICommandErrorIssueCode | ICommandHintIssueCode

export interface ICommandIssueReason {
  code: ICommandIssueCode
  message: string
  details?: Record<string, unknown>
}

export interface ICommandPresetIssueMeta {
  file?: string
  profile?: string
  variant?: string
  optionKey?: string
}

export interface ICommandIssueBase {
  kind: ICommandIssueKind
  stage: ICommandStage
  originStage?: ICommandStage
  source?: ICommandIssueSourceAttribution
  scope: ICommandIssueScope
  preset?: ICommandPresetIssueMeta
}

export interface ICommandErrorIssue extends ICommandIssueBase {
  kind: 'error'
  reason: Omit<ICommandIssueReason, 'code'> & { code: ICommandErrorIssueCode }
}

export interface ICommandHintIssue extends ICommandIssueBase {
  kind: 'hint'
  reason: Omit<ICommandIssueReason, 'code'> & { code: ICommandHintIssueCode }
}

export type ICommandIssue = ICommandErrorIssue | ICommandHintIssue
```

硬约束（MUST）：

1. `kind='error'` 的 issue 必须唯一且位于 `issues[0]`。
2. `kind='error'` 只能使用 `ICommandErrorIssueCode`；`kind='hint'` 只能使用 `ICommandHintIssueCode`。
3. `source.primary==='preset'` 时，`preset` 必须存在，且 `file/profile/variant` 至少提供一项。
4. 当 `source` 不包含 `preset` 来源时，`preset` 必须为空。

建议约束（SHOULD）：

1. `source` 不应是空对象（至少包含 `primary` 或 `related` 之一）。
2. `source.related` 存在时应去重，且长度至少为 2。
3. `source.primary` 与 `source.related` 同时存在时，`source.primary` 应属于 `source.related`。
4. `source.related` 包含 `'preset'` 且存在可定位 preset 来源时，`preset` 应提供定位信息。

---

## Error 聚合接口

```ts
export interface ICommandErrorMeta {
  commandPath: string
  token?: string
  option?: string
  argument?: string
  issues: ICommandIssue[]
}

export class CommanderError extends Error {
  public readonly kind: ICommanderErrorKind
  public readonly commandPath: string
  public readonly meta?: ICommandErrorMeta

  public withIssue(issue: ICommandIssue): CommanderError
  public withIssues(issues: ICommandIssue[]): CommanderError
}
```

约束：

1. `kind` 保留现有语义（`UnknownOption` / `UnexpectedArgument` 等），用于兼容主错误分类。
2. `meta.issues` 是主诊断载体；`message` 仅用于人类可读摘要。
3. `format()` 根据 `meta.issues` 渲染多行提示；渲染函数不做推断，只做展示。

`CommanderError.kind` 与 `ICommandErrorIssueCode` 必须保持 1:1 映射（转换为 snake_case）；hint code 不参与该映射。

### 诊断构建器约束（MUST）

最终设计中，所有 issue 必须经统一诊断构建器（Diagnostics Builder）归一化后进入 `CommanderError.meta.issues`。

`finalize()` 必须至少执行以下动作：

1. 保证主错误唯一并固定在 `issues[0]`。
2. 保证 `kind/code` 绑定正确（error code / hint code 不混用）。
3. 归一化 `source`（空对象移除、`related` 去重）。
4. 保证 `source/preset` 一致性：不涉及 preset 时移除 `preset`；`source.primary='preset'` 时校验定位信息。

`finalize()` 建议动作（SHOULD）：

1. 在 mixed-source `option_conflict` 场景自动补齐 `mixed_source_conflict` hint（若未存在）。

说明：渲染层只消费已归一化 issue，不承担语义修复职责。

---

## Source Trace 路径

### 1) 输入段

```ts
export interface ICommandArgvSegment {
  value: string
  source: 'user' | 'preset'
  preset?: ICommandPresetIssueMeta
}
```

### 2) token 继承来源

```ts
export interface ICommandToken {
  original: string
  resolved: string
  name: string
  type: 'long' | 'short' | 'none'
  source: 'user' | 'preset'
  preset?: ICommandPresetIssueMeta
}
```

### 2.5) preset 应用状态（不进入 issues）

```ts
export type ICommandPresetSourceState = 'skipped' | 'none' | 'applied'

export interface ICommandPresetSourceMeta {
  applied: boolean
  file?: string
  profile?: string
  variant?: string
}

export interface ICommandInputSources {
  preset: {
    state: ICommandPresetSourceState
    argv: string[]
    envs: Record<string, string>
    meta?: ICommandPresetSourceMeta
  }
  user: {
    cmds: string[]
    argv: string[]
    envs: Record<string, string | undefined>
  }
}
```

规则：

1. `preset profile` 是否被采用，不通过 `hint issue` 暴露。
2. PRESET 状态统一通过 `ctx.sources.preset.state` 暴露：`skipped | none | applied`。
3. `ctx.sources.preset.state==='applied'` 时，`ctx.sources.preset.meta?.applied` 必须为 `true`。
4. `ctx.sources.preset.meta?.file/profile/variant`（若存在）应与 PRESET 决议结果一致。
5. short-circuit（`control-run`）路径不进入 PRESET，因此 `ctx.sources.preset.state='skipped'` 且 `ctx.sources.preset.meta` 为空。

### 3) 抛错时写入 issue

规则：

1. 若可定位到触发 token，则 `issue.source.primary` 与 token.source 一致。
2. 若 token.source = `preset`，则拷贝 token.preset 到 `issue.preset`。
3. 若错误发生在 `resolve/parse` 但根因来自 `preset` 注入，则 `originStage='preset'`。

### 4) 无 token 错误归因

规则：

1. 若错误无触发 token 且与输入 token 无关（如纯配置错误），`source` 留空。
2. 若错误无触发 token，但可确定由 user 输入缺失导致（如 `missing_required_argument`），`source={ primary:'user' }`。
3. 若错误无触发 token，但可确定由 preset 注入导致（如 preset 注入后导致必填参数被覆盖为空），`source={ primary:'preset' }` 并附带 `preset`。

### 5) 多来源冲突归因

规则：

1. 冲突类错误（如 `option_conflict`）允许同时涉及 user/preset。
2. 此时 `source.related` 标记参与来源，例如 `['user', 'preset']`。
3. 若能确定主来源，可额外设置 `source.primary`；否则仅保留 `source.related`。

### 6) RUN/ACTION 错误归因

规则：

1. `action` 回调抛错时，统一映射为 `stage='run'`、`scope='action'`。
2. `reason.code` 使用 `action_failed`，`reason.message` 为统一可读摘要。
3. 原始异常内容放入 `reason.details`（需做安全裁剪，避免泄露敏感信息）。
4. 若异常可归因到输入来源，可填写 `source.primary`；否则 `source` 留空。

---

## Hint 生成规则（v1）

1. 默认每个错误至少带 1 条 `error issue`。
2. 当 `source.primary='preset'` 时，附加 1 条 `hint issue`，说明来源路径。
3. 当 `source.primary='user'` 时，不附加 preset hint。
4. 当可定位到冲突项分别来自 `user` 与 `preset` 时，可附加 1 条冲突来源 hint（`reason.code='mixed_source_conflict'`，`source.related=['user','preset']`）。
5. 当错误为 `unknown_subcommand` 且当前 command 不接受位置参数时，应附加 `command_does_not_accept_positional_arguments` hint。
6. 当错误为 `unknown_subcommand` 且存在唯一高置信候选子命令时，应附加 `did_you_mean_subcommand` hint。
7. `preset profile` 采用事件不生成 hint issue；若需观测采用状态，读取 `ctx.sources.preset.state` 与 `ctx.sources.preset.meta`。

设计决策备注（已评估）：

1. `option_conflict` 的 mixed-source 场景默认保留两条 hint：`mixed_source_conflict` + `preset_token_injected`。
2. 原因：前者回答“冲突由哪些来源共同导致”，后者回答“preset 注入路径是什么（file/profile/variant）”；两者信息维度不同，不互相替代。
3. CLI 渲染层可按需要做去重/折叠，但结构化 `issues` 层默认保留完整诊断信息。

示例 hint reason：

```ts
{
  code: 'preset_token_injected',
  message: 'token was injected from preset profile opts',
  details: {
    token: '--unknown-option',
    file: 'preset.json',
    profile: 'dev'
  }
}
```

---

## CLI 渲染约定

输出顺序：

1. 主错误（`issues[0]`）
2. 附加 hints（按 `issues[1..]` 顺序）
3. usage 指引（`Run "<path> --help" for usage.`）

渲染示例：

```text
Error: unknown option "--unknown-option"
Hint: token "--unknown-option" was injected from preset profile "dev" (preset.json)
Run "cli --help" for usage.
```

---

## 判例

1. `source.primary='user'` 的 unknown option

```json
{
  "issues": [
    {
      "kind": "error",
      "stage": "resolve",
      "scope": "option",
      "source": {
        "primary": "user"
      },
      "reason": {
        "code": "unknown_option",
        "message": "unknown option \"--bad-opt\""
      }
    }
  ]
}
```

2. `source.primary='preset'` 的 unknown option

```json
{
  "issues": [
    {
      "kind": "error",
      "stage": "resolve",
      "originStage": "preset",
      "scope": "option",
      "source": {
        "primary": "preset"
      },
      "reason": {
        "code": "unknown_option",
        "message": "unknown option \"--unknown-option\""
      },
      "preset": {
        "file": "preset.json",
        "profile": "dev",
        "optionKey": "unknownOption"
      }
    },
    {
      "kind": "hint",
      "stage": "resolve",
      "originStage": "preset",
      "scope": "preset",
      "source": {
        "primary": "preset"
      },
      "reason": {
        "code": "preset_token_injected",
        "message": "token was injected from preset profile opts"
      },
      "preset": {
        "file": "preset.json",
        "profile": "dev",
        "optionKey": "unknownOption"
      }
    }
  ]
}
```

3. preset 注入导致 unexpected argument

```json
{
  "issues": [
    {
      "kind": "error",
      "stage": "parse",
      "originStage": "preset",
      "scope": "argument",
      "source": {
        "primary": "preset"
      },
      "reason": {
        "code": "unexpected_argument",
        "message": "unexpected argument \"orphan\""
      },
      "preset": {
        "file": "preset.json",
        "profile": "dev"
      }
    },
    {
      "kind": "hint",
      "stage": "parse",
      "originStage": "preset",
      "scope": "preset",
      "source": {
        "primary": "preset"
      },
      "reason": {
        "code": "preset_token_injected",
        "message": "argument token was injected from preset profile opts"
      },
      "preset": {
        "file": "preset.json",
        "profile": "dev"
      }
    }
  ]
}
```

4. 无 token 的 missing required argument

```json
{
  "issues": [
    {
      "kind": "error",
      "stage": "parse",
      "scope": "argument",
      "source": {
        "primary": "user"
      },
      "reason": {
        "code": "missing_required_argument",
        "message": "missing required argument \"input\"",
        "details": {
          "argument": "input"
        }
      }
    }
  ]
}
```

5. user + preset 共同导致 option conflict

```json
{
  "issues": [
    {
      "kind": "error",
      "stage": "parse",
      "scope": "option",
      "source": {
        "related": ["user", "preset"]
      },
      "reason": {
        "code": "option_conflict",
        "message": "option conflict: \"--shell\" cannot be used with \"--all-shells\"",
        "details": {
          "left": "--shell",
          "right": "--all-shells"
        }
      }
    },
    {
      "kind": "hint",
      "stage": "parse",
      "scope": "option",
      "source": {
        "related": ["user", "preset"]
      },
      "reason": {
        "code": "mixed_source_conflict",
        "message": "option conflict involves both user input and preset-injected tokens"
      }
    },
    {
      "kind": "hint",
      "stage": "parse",
      "originStage": "preset",
      "scope": "preset",
      "source": {
        "primary": "preset"
      },
      "reason": {
        "code": "preset_token_injected",
        "message": "one of the conflicting options was injected from preset profile opts"
      },
      "preset": {
        "file": "preset.json",
        "profile": "dev"
      }
    }
  ]
}
```

6. action 抛错（run 阶段）

```json
{
  "issues": [
    {
      "kind": "error",
      "stage": "run",
      "scope": "action",
      "reason": {
        "code": "action_failed",
        "message": "action failed",
        "details": {
          "errorName": "TypeError",
          "errorMessage": "Cannot read properties of undefined"
        }
      }
    }
  ]
}
```

7. unknown subcommand 的结构化 hints

```json
{
  "issues": [
    {
      "kind": "error",
      "stage": "parse",
      "scope": "command",
      "reason": {
        "code": "unknown_subcommand",
        "message": "unknown subcommand \"watc\" for command \"cli build\""
      }
    },
    {
      "kind": "hint",
      "stage": "parse",
      "scope": "command",
      "reason": {
        "code": "did_you_mean_subcommand",
        "message": "did you mean \"watch\"?",
        "details": {
          "candidate": "watch"
        }
      }
    },
    {
      "kind": "hint",
      "stage": "parse",
      "scope": "command",
      "reason": {
        "code": "command_does_not_accept_positional_arguments",
        "message": "command \"cli build\" does not accept positional arguments"
      }
    }
  ]
}
```

---

## 实施顺序（非规范）

1. 先冻结当前行为快照与 issue invariant 基线测试。
2. 再收敛 Diagnostics Builder，统一 issue 生成与归一化。
3. 随后收敛 Source Ledger，统一 `source/preset` 归因。
4. 然后统一 Execution Kernel，收敛 `run/parse` 执行入口。
5. 最后补齐测试矩阵，确保 code/spec 一一映射。

详细实施清单见 [command.md](./command.md)“执行内核约束 / run/parse 契约 / control-run 规则”。
