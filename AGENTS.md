# Breachmap

Turns a security incident into a sourced, interactive attack map (one offline HTML file).
Stack: Node 26, pnpm 12, TypeScript 7 (strict), Zod 4, Vitest, Biome. ESM only.

## Commands
- Node 26 first: `nvm use`
- Install: `pnpm install`
- Lint and format (code and JSON, not Markdown): `pnpm lint`; auto-fix: `pnpm biome check --write .`
- Full check, must pass before done: `pnpm check` (lint + typecheck + test + arch)
- One test file: `pnpm vitest run <path/to/file.test.ts>`
- One package: `pnpm --filter @breachmap/core test`
- Update snapshots, only when the output change is intended: `pnpm test -u`

## Claude Code
- `.claude/settings.json`: after each Edit/Write, Biome formats and lints the file
  (`.claude/hooks/format.sh`); on Stop with uncommitted changes, `pnpm check` runs and a
  failure sends Claude back once (`.claude/hooks/check.sh`).
- `git push`, `npm publish` and `pnpm publish` always ask. `.env` files cannot be read.
- Subagents in `.claude/agents/`: `test-writer` writes failing tests first for new logic,
  `security-auditor` checks any render or skill change, `reviewer` reviews every diff before commit.

## Architecture
Dependency direction: cli → render → core → schema. Enforced by `pnpm check:arch`
(`scripts/check-arch.ts`): layer order, no relative imports across packages, no I/O, clock,
randomness or Node built-ins in schema/core/render (render may use `node:crypto`), and no
`innerHTML`-style APIs outside tests.
- `packages/schema/src/incident.ts`: the incident contract. Read this first.
- `packages/core`: validation + layout. Pure: no fs, network, clock or randomness.
- `packages/render`: JSON → HTML. Deterministic. See `packages/render/AGENTS.md`.
- `packages/cli`: the only package allowed to do I/O.
- Decisions: `docs/adr/`. Feature specs: `specs/NNN-name/`.

## Workflow
1. Read the spec in `specs/`. No spec → ask before building.
2. Write a short plan and wait for approval.
3. Write a failing test, then the code.
4. Run `pnpm check` and fix until green.
5. Commit with a conventional message, e.g. `feat(core): add source validation`.

## Always
- Keep core and render pure and deterministic.
- Return `Result` types from core (see `packages/core/src/result.ts`). Don't throw.
- Require a source URL for every incident step.
- End relative imports in `.ts` and use only erasable TypeScript (no `enum`, `namespace`),
  so Node runs the sources directly (`node scripts/check-arch.ts`).
- Put tests next to the code as `*.test.ts`.

## Ask first
- Adding a dependency.
- Changing the schema (needs an ADR in `docs/adr/`).
- Changing CI, release or hook config.

## Never
- Write working exploit code. Explain attacks and defenses only.
- Put unescaped incident text into HTML, or use `innerHTML`.
- Add network requests to generated HTML.
- Commit secrets or `.env` files.
- Edit tests or snapshots just to make them pass.