---
"@guanghechen/commander": minor
---

Apply code review fixes:

- Fix `#getCommandPath` to return full command path (e.g., "cli sub" instead of just "sub")
- Remove unused `#parseLongOption` and `#parseShortOption` dead code
- Improve `--no-{option}` help description to "Negate --{option}"
- Document short option negative value limitation in spec
