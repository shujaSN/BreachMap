# Breachmap

Turns a security incident into a sourced, interactive attack map (one offline HTML file).
Stack: Node 26, pnpm 12, TypeScript 7 (strict), Zod 4, Vitest. ESM only.

## Commands
- Install: `pnpm install`
- Full check, must pass before done: `pnpm check` (lint + typecheck + test + arch)
- One test file: `pnpm vitest run <path/to/file.test.ts>`
- One package: `pnpm --filter @breachmap/core test`
- Update snapshots, only when the output change is intended: `pnpm test -u`

## Architecture
Dependency direction: cli → render → core → schema. Enforced by `pnpm check:arch`.
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