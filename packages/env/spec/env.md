# @guanghechen/env

轻量级 .env 文件解析器，支持变量插值。

## 特性

- 零依赖，纯 JavaScript
- 支持浏览器和 Node.js
- 支持 `${VAR}` 变量插值（双引号/无引号）
- 支持注释、`export` 前缀、引号值

## API

```typescript
type IEnvRecord = Record<string, string>

interface IStringifyEnvOptions {
  exclude?: string[] // 排除的键
}

function parse(content: string): IEnvRecord
function stringify(env: IEnvRecord, options?: IStringifyEnvOptions): string
```

## 语法

```bash
# 注释
KEY=value
KEY = value           # 等号两侧可有空格
KEY: value            # 冒号分隔也支持
export KEY=value      # 支持 export 前缀

# 双引号：处理转义序列和变量插值
MESSAGE="line1\nline2"
PATH="C:\\Users\\test"
DATA="${HOME}/data"

# 单引号：原样保留，不处理转义和插值
RAW='${NOT_INTERPOLATED}'
LITERAL='line1\nline2'

# 无引号：支持变量插值
DATA=${HOME}/data
COLOR=#fff            # # 紧跟值时保留
NAME=value # comment  # 空格+# 视为注释

# 转义变量插值
LITERAL=\${VAR}       # -> ${VAR}
```

## 示例

### 解析

```javascript
import { parse } from '@guanghechen/env'

const env = parse(`
NAME=app
PORT=3000
DATA=\${NAME}/data
`)
// { NAME: 'app', PORT: '3000', DATA: 'myapp/data' }
```

### 序列化

```javascript
import { stringify } from '@guanghechen/env'

stringify({ NAME: 'app', PORT: '3000' })
// NAME=app
// PORT=3000

stringify({ COLOR: '#fff' })
// COLOR="#fff"

stringify(env, { exclude: ['SECRET'] }) // 排除指定键
```

### 合并

```javascript
const base = { NAME: 'base', PORT: '8080' }
const override = parse('NAME=new\nDEBUG=true')
const result = { ...base, ...override }
// { NAME: 'new', PORT: '8080', DEBUG: 'true' }
```
