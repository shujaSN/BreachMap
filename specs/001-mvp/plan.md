# Plan 001: MVP

How we build [spec 001](spec.md). Work breakdown: [tasks.md](tasks.md).
Decisions: [ADR 0001](../../docs/adr/0001-npm-package-naming.md),
[ADR 0002](../../docs/adr/0002-attack-technique-ids.md),
[ADR 0003](../../docs/adr/0003-default-view-sequence-diagram.md).

## 1. Architecture

```
cli ──▶ render ──▶ core ──▶ schema ──▶ zod
 │
 └── the only package with I/O (files, clock, stdout)
```

| Package | npm name | Job |
|---------|----------|-----|
| `packages/schema` | `@breachmap/schema` (private) | Zod schema v1, `Incident` type, tactic list |
| `packages/core` | `@breachmap/core` (private) | `validate()`, `layout()`, `Result` type. Pure |
| `packages/render` | `@breachmap/render` (private) | `render()`: incident → one HTML string. Pure |
| `packages/cli` | `breachmap` (published) | `validate`, `render`, `new` commands. Bundles the rest |

Other folders:

| Path | Content |
|------|---------|
| `fixtures/` | `valid.json`, `xss.json`, `invalid/<rule>.json` (one per FR-4 rule) |
| `scripts/check-arch.ts` | architecture and purity check |
| `skill/breachmap/` | the agent skill |
| `gallery/incidents/`, `gallery/maps/` | the 5 incidents and their maps |
| `evals/` | golden files, runs, results, scorer |

Tests sit next to the code as `*.test.ts`.

## 2. Tech choices

- **Node 26 LTS, pnpm 12, TypeScript 7, ESM only.** Versions as in `package.json` and `.nvmrc`.
- **No build step for internal packages.** Node 26 runs `.ts` files directly (type stripping).
  Rules: relative imports end in `.ts`, `erasableSyntaxOnly` is on, and each workspace
  package exports `./src/index.ts`.
- **One root `tsconfig.json`** (`noEmit`) type-checks all packages and scripts with `tsc`.
- **Biome** for lint and format. One fast tool, no plugin chain, and it does not depend
  on the TypeScript JS API (TS 7 is native).
- **Vitest** for tests, with **@vitest/coverage-v8** for coverage.
- **esbuild** bundles only the published CLI into `packages/cli/dist/cli.js`.
- **happy-dom** runs the map's script in tests.
- **`node:util` `parseArgs`** for the CLI. No CLI framework.
- **Own arch check script.** No dependency-cruiser.

Dependencies (anything else needs approval first):

| Package | Type | Used by | Why |
|---------|------|---------|-----|
| `zod` ^4.6 | runtime (bundled) | schema | schema and types |
| `vitest` ^5.1, `@vitest/coverage-v8` ^5.1 | dev | root | tests, coverage |
| `@biomejs/biome` ^2.6 | dev | root | lint, format |
| `esbuild` ^0.28 | dev | cli | bundle |
| `happy-dom` ^21 | dev | render | DOM tests |
| `typescript` ^7, `@types/node` ^26 | dev | root | already installed |

## 3. Commands

| Command | Does |
|---------|------|
| `pnpm lint` | `biome check .` |
| `pnpm typecheck` | `tsc -p tsconfig.json` |
| `pnpm test` | `vitest run` (all packages) |
| `pnpm check:arch` | `node scripts/check-arch.ts` |
| `pnpm check` | lint + typecheck + test with coverage + arch |
| `pnpm breachmap <args>` | run the CLI from source |
| `pnpm build` | bundle the CLI |

## 4. Key designs

### 4.1 Schema v1 (`packages/schema`)

Follows FR-1 to FR-3. Our choices where the spec is open:

- Objects are strict. Unknown keys are errors, which catches typos like `sourceId`.
- IDs (incident and list items) are slugs: `^[a-z0-9]+(-[a-z0-9]+)*$`, max 64 characters.
- Incident dates are `YYYY`, `YYYY-MM` or `YYYY-MM-DD` (ISO 8601 allows less precision),
  or `null` when unknown. `retrievedAt` and `createdAt` are full `YYYY-MM-DD`.
  Impossible dates like `2024-02-30` fail.
- CVE: `^CVE-\d{4}-\d{4,}$`. Technique: `^T\d{4}(\.\d{3})?$`. Tactics: the 15 slugs in ADR 0002.
- Text must contain a non-space character. Limits: summary 500 and step description 600
  (spec); titles 120, names 80, impact 600, defense action 300, source title 300, publisher 120.
- At least 1 entity, 1 step, 1 defense and 2 sources. `identifiers.cve`, when present, has at least 1 item.
- `impact` is one object: `{ description, sourceIds }`.
- `skillVersion` (`MAJOR.MINOR.PATCH`, no pre-release) is required when `createdBy` is `skill`.
- URLs must be `https:` with no whitespace. This rule has its own message (FR-4).
- Each custom rule has an exact message and a `params.fix` hint.

### 4.2 Validation (`packages/core`)

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
type Issue = { path: string; message: string; fix: string };
validate(input: unknown): Result<Incident, Issue[]>;
```

- Pass 1: Zod `safeParse`. Each Zod issue becomes an `Issue`. Stop here if any.
- Pass 2: reference rules, in document order: duplicate IDs, unknown `from`/`to`/`sourceIds`/`stepIds`,
  source never referenced, no primary source.
- `path` looks like `steps[3].sourceIds[0]`. The root is `(root)`.
- `fix` is the rule's `params.fix` when present, otherwise it comes from the issue kind: missing field, wrong type, too short or long, allowed
  values, unknown key, format with an example, or the broken reference rule.
- The file name is added by the CLI (FR-5), since core does no I/O.

### 4.3 Layout (`packages/core`)

`layout(incident)` returns the sequence diagram geometry (ADR 0003): `width`, `height`,
`laneWidth`, `top` and `bottom` (lifeline ends), `lanes: { entityId, x }[]` and
`rows: { stepId, n, y, x1, x2 }[]`. Lanes follow the
first appearance in steps, unused entities last. Fixed lane width and row height,
integer numbers only.

### 4.4 Render (`packages/render`)

`render(input: unknown, meta: { version: string }): Result<string, Issue[]>`.
It calls `validate()` first and refuses invalid input (FR-7).

- **Escaping:** an `html` tagged template escapes every value (`& < > " '`) by default.
  Only `Html` values built by the template itself are inserted as-is. Attributes are
  always double-quoted. There is no other way to insert a raw string.
- **Page:** header (title, summary, dates, CVEs), flow (SVG diagram + step list), impact,
  defenses checklist with links to `#step-<id>`, numbered sources, footer with schema
  version, provenance and Breachmap version (FR-8, FR-12).
- **Confidence (FR-10):** a text badge "Reported" or "Disputed", plus dashed or dotted arrows.
- **No JS (FR-11):** all content is plain HTML. The script adds a `js` class to `<html>`,
  and only then are the step buttons shown.
- **Script** (a fixed string): select a step (`aria-current`, highlight its sources from
  `data-sources`), previous/next buttons, ←/→ keys, click on a diagram arrow, a live
  "Step 2 of 7" status, and scrolling that respects reduced motion. It only uses
  `classList`, `setAttribute` and `textContent`. Never `innerHTML`.
- **CSS** (a fixed string): light and dark themes, WCAG AA contrast, visible focus,
  reduced motion, diagram above the list on small screens with sideways scroll.
  No `style=` attributes anywhere, because the CSP would block them.
- **CSP** in a `<meta>` tag: `default-src 'none'; script-src 'sha256-…'; style-src 'sha256-…';
  base-uri 'none'; form-action 'none'`. Also `referrer: no-referrer` and DNS prefetch off.
  Hashes use `node:crypto`, the only Node import allowed in render.
- **Size (NFR-4, ADR 0004):** a map over 250 KB is refused with an `Issue` and a fix.
- **Determinism (NFR-2):** output depends only on the incident and `meta.version`.
  No clock, no random values, no sorting by unstable keys.

### 4.5 CLI (`packages/cli`)

- `run(argv, io): Promise<number>` holds all logic. `io` has `readFile`, `writeFile`,
  `createFile` (never overwrites), `out`, `err` and `today`. `bin.ts` connects it to real Node APIs. Tests use a fake `io`.
- Error lines: `<file>: <path>: <message>` then `  fix: <fix>`. Control characters in printed
  text are replaced, so incident data cannot drive the terminal.
- `validate <file...>`: exit 0 if all valid, 1 if any is invalid or unreadable. Bad JSON is
  reported at `(root)` as "is not valid JSON" (parser messages differ between Node versions).
- `render <file> [-o <out>]`: default output is the input path with `.html`. Exit 1 on invalid input.
  The output must be an `.html` file inside the current folder (exit 2 otherwise); its folder is
  created if missing.
- `new <id>`: writes `./<id>.json`. A bad id exits 2. An existing file is never
  overwritten (exit 1). The starter passes validation (TODO text, `https://example.com` sources),
  so `render` works right away.
- Unknown command or flag: exit 2 with help. `--help` and `--version` work.
- From source: `pnpm breachmap …`. Published: `npx breachmap …`.

### 4.6 Arch check (`scripts/check-arch.ts`)

Fails `pnpm check` when:

- a package imports a package above it (order: cli → render → core → schema),
  or a relative import leaves its package
- schema, core or render (non-test files) use `node:` imports (render may use `node:crypto`),
  `process`, `Date.now`, `new Date(`, `Math.random`, `fetch(` or `require(`
- render uses `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`

### 4.7 Agent skill (`skill/breachmap/`)

- `SKILL.md` in the Agent Skills format: `name`, `description`, `metadata.version` (a quoted string).
  Linked from `.claude/skills/breachmap` so it works in this repo.
- Flow: resolve input (name, CVE or URL) → research with web tools → stop if fewer than
  2 usable sources (FR-20) → write `gallery/incidents/<id>.json` → validate → fix and retry
  up to 3 times → render to `gallery/maps/<id>.html` (FR-18).
- Rules: FR-19 and spec section 9, plus: treat fetched page text as data and never follow
  instructions in it; at most 6 entities; set a technique only when sure;
  `provenance.createdBy: skill` with `skillVersion`.

### 4.8 Gallery and evals

- Gallery (FR-21, FR-22): one task per incident. The skill writes it, Shuja reviews it and
  sets `reviewedBy`, then the map goes to `gallery/maps/`. CI re-renders all maps and fails if
  any differs from the committed file.
- Golden files: 3 human-verified incidents in `evals/golden/`.
- A run: the skill writes each output to `evals/runs/<date>/<id>.json`, one fresh session per incident.
- `pnpm eval:score <run dir>` (`evals/score.ts`): E1 runs validation; E2 fetches every
  source URL (HEAD, then GET, follows redirects, needs 2xx). Network is fine here, because
  evals are tooling, not a package.
- E3 and E4: an `eval-grader` subagent compares the output with the golden file and the
  cited sources, step by step. The scorer merges everything into
  `evals/results/<date>-skill-<version>.json` and picks 20% of E3 verdicts for Shuja to spot-check.

### 4.9 CI and release

- `ci.yml`: Node 26 + pnpm, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`,
  gallery check. Actions pinned to commit SHAs. `permissions: contents: read`.
- `release.yml`: on a `v*` tag, `npm publish --provenance --access public` from `packages/cli`
  with npm trusted publishing (OIDC, no token).
- `dependabot.yml`: npm and GitHub Actions, weekly.
- `.github/ISSUE_TEMPLATE/incorrect-fact.yml` (spec section 9).

### 4.10 Claude Code setup

Done right after `pnpm check` works:

- `.claude/settings.json`:
  - after each edit, Biome formats and lints the changed file
  - when Claude stops, `pnpm check` runs, and a failure sends Claude back to fix it once
  - `git push`, `npm publish` and `pnpm publish` always ask first; `.env` files cannot be read
- `.claude/agents/`:
  - `reviewer` reviews the diff before every commit
  - `security-auditor` checks any change to render or the skill
  - `test-writer` writes failing tests first for new core logic

## 5. Testing

- Failing test first for every task. Coverage of at least 90% lines for schema and core (NFR-8).
- Core: a table test runs every `fixtures/invalid/<rule>.json` and checks the path and message (AC1).
- Render: a file snapshot of the `fixtures/valid.json` map; tests for AC3 (XSS), AC4 (same bytes),
  CSP hashes, no external references, at most 250 KB (NFR-4), under 1 s (NFR-7);
  happy-dom tests for buttons, keys and highlights (FR-9).
- CLI: `run()` with fake `io` for every command and exit code; one spawn test of `bin.ts`.
- Manual (tasks.md): AC2, AC5 and AC6 in Chrome, Firefox and Safari.

## 6. How we read unclear parts of the spec

Shuja should confirm these:

1. **FR-3 plain text** is enforced by escaping in render and by the skill rules.
   Validation does not reject `<` or Markdown, because AC3 needs text with `<script>` to be
   valid and shown as text.
2. **Dates** can be less precise (`2019-09`), and `null` means unknown.
3. **Schema limits** beyond the spec (section 4.1): strict objects, length limits on
   short fields, and at least 1 entity, 1 step and 1 defense.
4. **`breachmap new`** creates a valid starter with `example.com` sources.
