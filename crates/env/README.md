# guanghechen-env

Deterministic, zero-dependency `.env` parsing, serialization, and recursive environment
resolution.

`parse` follows declaration order, matching `@guanghechen/env`: interpolation can reference
earlier declarations. `resolve` instead resolves the final declaration graph, including forward
and transitive references. Keys may contain `.` and `-` as literal name characters, but neither may
be the first or last character.

Single- and double-quoted values may span physical lines. Raw line endings normalize to `\n`;
single quotes remain literal, while double quotes continue to process escapes and interpolation.

```dotenv
database.host=localhost
database-port=5432
MESSAGE="hello ${database.host}
# part of the value"
```

`stringify` validates keys and returns `StringifyError` instead of emitting assignments that the
parser would discard. It also escapes interpolation-shaped literals and all parser-sensitive
whitespace so that `parse(stringify(env)?)` preserves the record.

```rust
use guanghechen_env::{parse, resolve};

let parsed = parse("ROOT=/opt\nBIN=${ROOT}/bin").unwrap();
assert_eq!(parsed.get("BIN").map(String::as_str), Some("/opt/bin"));

let resolved = resolve("BIN=${ROOT}/bin\nROOT=/opt").unwrap();
assert_eq!(resolved.get("BIN").map(String::as_str), Some("/opt/bin"));
```

`resolve_upward` accepts sources from nearest to farthest. It first selects the nearest declaration
for every key, then resolves references across that final graph. A cycle aborts the whole
operation.

```rust
use guanghechen_env::resolve_upward;

let parent = "A=${B}\nB=parent";
let grandparent = "A=${C}\nB=grandparent\nC=grandparent";
let env = resolve_upward([parent, grandparent]).unwrap();

assert_eq!(env.get("A").map(String::as_str), Some("parent"));
assert_eq!(env.get("B").map(String::as_str), Some("parent"));
```

Unknown references resolve to an empty string. Single-quoted and escaped references remain
literal.

`resolve_upward_files` discovers multiple prioritized files in each directory. Directories are
searched from nearest to farthest; only within one directory does file-name order apply. A root
directory is inclusive. Passing `None` walks to the current filesystem root or Windows volume
root.

```rust,no_run
use std::path::Path;

use guanghechen_env::resolve_upward_files;

let env = resolve_upward_files(
    [".env.local", ".env.prod", ".env"],
    Path::new("apps/api"),
    Some(Path::new(".")),
)
.unwrap();

assert!(env.contains_key("APP_NAME"));
```

Missing files are skipped. File names must be single relative path components; absolute paths,
parent traversal, and nested paths are rejected.

## License

[MIT](https://github.com/guanghechen/sora/blob/rust/LICENSE)
