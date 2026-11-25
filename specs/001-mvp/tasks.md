# Tasks 001: MVP

Ordered work for [spec 001](spec.md) using [plan 001](plan.md).

Each task: failing test → code → `pnpm check` → reviewer → commit → tick here.
👤 = needs Shuja. 🛑 = ask Shuja first (AGENTS.md "Ask first" or a push/publish).

## Phase 0: Tooling

- [x] **T01** Workspace tooling: Node 26, Biome, Vitest + coverage, root `tsconfig.json`,
  scripts `lint`, `typecheck`, `test`, `check`; rename root package to `breachmap-workspace`;
  fix the stack line in AGENTS.md. (NFR-8, ADR 0001)
- [x] **T02** Arch check `pnpm check:arch`: layer order, package boundaries, purity bans,
  no `innerHTML` in render. Part of `pnpm check`. (NFR-1, NFR-3, AC9)
- [x] **T03** Hooks and permissions in `.claude/settings.json`. (plan 4.10)
- [x] **T04** Subagents: reviewer, security-auditor, test-writer. (plan 4.10)

## Phase 1: Schema

- [x] **T05** `@breachmap/schema`: Zod schema v1, `Incident` type, tactic list.
  (FR-1, FR-2, FR-3, FR-4 shape and https rules, ADR 0002)

## Phase 2: Core

- [x] **T06** `Result` type and Zod issue → `{ path, message, fix }`. (FR-5)
- [x] **T07** Reference rules and `validate()`: duplicate IDs, unknown references,
  unreferenced sources, no primary source. (FR-4, FR-6)
- [x] **T08** Fixtures: `valid.json`, `xss.json`, one `invalid/<rule>.json` per FR-4 rule,
  plus a table test. (AC1, AC3)
- [x] **T09** `layout()` for the sequence diagram. (FR-8, ADR 0003)

## Phase 3: Render

- [x] **T10** `html` tagged template that escapes by default. (NFR-1, FR-3)
- [x] **T11** Static page: head with CSP, header, steps, impact, defenses, sources, footer;
  file snapshot. (FR-7, FR-8, FR-10, FR-11, FR-12, NFR-2)
- [x] **T12** SVG sequence diagram from `layout()`. (FR-8, FR-10, ADR 0003)
- [x] **T13** CSS: themes, AA contrast, focus, reduced motion, small screens. (NFR-5, NFR-6)
- [x] **T14** Map script: step buttons, ←/→ keys, source highlight, defense links;
  happy-dom tests. (FR-9, NFR-6)
- [ ] **T15** Safety and budget tests: XSS, same bytes, CSP hashes, no external references,
  at most 250 KB, under 1 s. (AC3, AC4, NFR-1, NFR-2, NFR-4, NFR-7)
- [ ] **T16** `packages/render/AGENTS.md` and a security-auditor pass on render. (NFR-1)

## Phase 4: CLI

- [ ] **T17** `run()` with `parseArgs`: `--help`, `--version`, usage errors exit 2. (FR-16)
- [ ] **T18** `validate` command. (FR-13, FR-5, AC1)
- [ ] **T19** `render` command. (FR-14, FR-7)
- [ ] **T20** `new` command. (FR-15)
- [ ] **T21** `bin.ts`, `pnpm breachmap`, esbuild bundle with `pnpm build`, spawn test. (FR-16, ADR 0001)

## Phase 5: Skill, gallery, evals

- [ ] **T22** Skill `skill/breachmap/SKILL.md`, linked in `.claude/skills/`;
  security-auditor pass. (FR-17, FR-18, FR-19, FR-20)
- [ ] **T23** 👤 Gallery: xz Utils backdoor. (FR-21, FR-22)
- [ ] **T24** 👤 Gallery: Log4Shell. (FR-21, FR-22)
- [ ] **T25** 👤 Gallery: SolarWinds Orion / SUNBURST. (FR-21, FR-22)
- [ ] **T26** 👤 Gallery: MOVEit Transfer. (FR-21, FR-22)
- [ ] **T27** 👤 Gallery: GitHub MCP prompt-injection data leak. (FR-21, FR-22)
- [ ] **T28** 👤 3 golden files in `evals/golden/`. (spec section 10)
- [ ] **T29** Eval scorer `pnpm eval:score` (E1, E2) and `eval-grader` subagent (E3, E4). (AC8)
- [ ] **T30** 👤 Run evals and meet all E1 to E4 targets. (AC7, AC8)
- [ ] **T31** 👤 Browser checks in Chrome, Firefox and Safari: offline, zero requests,
  JS off, keyboard only. (AC2, AC5, AC6, NFR-5)

## Phase 6: CI and release

- [ ] **T32** 🛑 CI workflow with gallery check, Dependabot, "Incorrect fact" issue template.
  (NFR-8, NFR-9, AC9, spec section 9)
- [ ] **T33** 🛑 Release workflow: npm trusted publishing with provenance. (NFR-9)
- [ ] **T34** README: GIF, 3-step quickstart, limitations. (AC10)
- [ ] **T35** 🛑 👤 Check the npm name, tag v0.1.0, push, publish. (AC10, ADR 0001)
