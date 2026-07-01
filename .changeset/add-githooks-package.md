---
'@guanghechen/githooks': minor
---

Add `@guanghechen/githooks`: a tiny zero-dependency git hooks installer driven by a `githooks` field
in package.json. Generates hook scripts into `.githooks/` and wires them via `core.hooksPath`, with
CI detection and a `GITHOOKS=0` bypass. Replaces the husky + is-ci + pinst trio for simple setups.
