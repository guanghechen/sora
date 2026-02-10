---
"@guanghechen/commander": minor
---

Change args from string[] to Record<string, unknown> with type/coerce/default support:
- `args` is now `Record<string, unknown>` keyed by argument name
- Add `rawArgs: string[]` for original argument strings before type conversion
- IArgument now supports `type`, `default`, and `coerce` properties
- Add `TooManyArguments` error kind for extra arguments validation
