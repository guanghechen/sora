---
"@guanghechen/commander": patch
---

Fix commander completion metadata and negative option rules.

- Include built-in control options (help/version) in completion metadata.
- Prevent generating negative completions for reserved controls (--no-help/--no-version).
- Align completion option metadata with explicit type/args semantics.
