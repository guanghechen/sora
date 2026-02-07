# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a TypeScript monorepo (`@guanghechen/*`) containing utility packages. Uses pnpm workspaces with independent versioning via changesets.

## Commands

```bash
# Development
pnpm build              # Build all packages (with sourcemaps)
pnpm build:production   # Build all packages (no sourcemaps)
pnpm test               # Run tests
pnpm test:coverage      # Run tests with coverage
pnpm format             # Lint and format

# Single package
pnpm --filter @guanghechen/byte build
pnpm --filter @guanghechen/byte test

# Publishing
pnpm changeset          # Create changeset for modified packages
pnpm :version           # Apply changesets (bump versions, update changelogs)
pnpm :publish           # Full release (clean, build, test, publish)
pnpm :publish:all       # Patch bump and publish all packages
```

## Release Workflow

1. Create changeset: `pnpm changeset`
2. Apply versions: `pnpm :version`
3. Commit changes
4. Publish: `pnpm :publish`
5. Create git tags after publish:
   ```bash
   for pkg in packages/*/package.json; do
     name=$(node -p "require('./$pkg').name")
     version=$(node -p "require('./$pkg').version")
     git tag "${name}@${version}"
   done
   ```
6. Push tags: `git push --tags`

## Package Structure

Each package in `packages/` follows:
- `src/` - TypeScript source
- `lib/` - Build output (esm, cjs, types)
- Dual ESM/CJS exports via rollup

## Tech Stack

- **Build**: Rollup + TypeScript
- **Test**: Vitest
- **Lint**: ESLint + Prettier
- **Versioning**: Changesets (independent mode)
