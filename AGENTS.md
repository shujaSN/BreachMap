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
- Run the CLI from source: `pnpm breachmap validate fixtures/valid.json` (also `render`, `new`)
- Bundle the published CLI to `packages/cli/dist/cli.js`: `pnpm build`
- Build the gallery site (landing page + maps) into `site/`: `pnpm site` (`scripts/build-site.ts`)
- CI: `.github/workflows/ci.yml` (check, build, gallery valid, maps up to date, site builds; on
  `main` a clean job rebuilds `site/` and deploys it to GitHub Pages). Release:
  `.github/workflows/release.yml` publishes `packages/cli` on a `v*` tag with npm provenance.
- Score an eval run (spec section 10): `pnpm eval:score evals/runs/<date>`. Grades for E3/E4 come
  from the `eval-grader` subagent in `evals/runs/<date>/grades/<id>.json`; results go to `evals/results/`.
- `pnpm-workspace.yaml` sets `allowBuilds: esbuild: false`: no install scripts run; approve new ones only on purpose

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
- `fixtures/`: `valid.json` (valid fictional incident), `xss.json` (valid, hostile text for
  escaping tests), `invalid/<rule>.json` (one per FR-4 rule; each file's expected issue is in
  `packages/core/src/fixtures.test.ts`, and a new file without one fails). Tests read fixtures with
  `readFileSync(new URL("../../../fixtures/…", import.meta.url))`, never a cross-package import.
- `packages/core`: validation + layout. Pure: no fs, network, clock or randomness.
  `validate(input)` is the one entry point: schema first, then reference rules (FR-4).
- `packages/render`: JSON → HTML. Deterministic. See `packages/render/AGENTS.md`.
- `packages/cli`: the only package allowed to do I/O.
- `skill/breachmap/SKILL.md`: the agent skill (Agent Skills format), linked from
  `.claude/skills/breachmap` so Claude Code loads it in this repo. On change, bump `metadata.version`
  and the `skillVersion` in its schema section together. Keep `allowed-tools` to the minimum.
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
- Report problems as `Issue` objects `{ path, message, fix }` (`packages/core/src/issues.ts`).
- Require a source URL for every incident step.
- Give every custom schema rule an exact message and a `params.fix` hint (FR-5).
- Build HTML only with the `html` tagged template (`packages/render/src/html.ts`). It escapes
  every value and throws (a coding bug, caught by tests) when a value or nested `html` sits outside
  a strict grammar of the template text before it: `<` only starts a tag; no comments or `<!`
  except a leading `<!doctype html>`; values only in text or a double-quoted value of an allowed
  attribute (`href` must be `https://`, `#…`, or follow a fixed `folder/` like `maps/`);
  `<script>`/`<style>` only in a full page before any svg, holding only value-free templates;
  nested `html` only in plain text, never leaving a tag or svg open. Any meta refresh throws.
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