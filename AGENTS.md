# AGENTS.md

TypeScript utility monorepo (`@guanghechen/*`) using pnpm workspaces and independent versioning with Changesets.

- Environment: follow `engines` in the root `package.json`; CI uses Node.js 24.
- Tools: TypeScript 7, tsdown (ESM/CJS/types), Vitest, Biome.
- Layout: each package has sources in `src/`, tests in `__test__/`, and build output in `lib/`.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`.
- Package tests: `pnpm --filter @guanghechen/<package> test`.
- Build checks: run `pnpm build`, then `pnpm test:dist --sourcemap`;
  run `pnpm build:production`, then `pnpm test:dist --no-sourcemap`.
