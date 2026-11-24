# Spec 001: MVP

| Field   | Value            |
|---------|------------------|
| Status  | Approved         |
| Author  | Shuja |
| Created | 2026-11-24       |
| Target  | v0.1.0           |
| Plan    | [plan.md](plan.md), [tasks.md](tasks.md) |

This spec defines **what** the MVP does and **why**. The **how** goes in `plan.md`,
and the work breakdown in `tasks.md`. Requirement IDs (FR, NFR, AC) are stable and
referenced from plans, tests and PRs.

## 1. Summary

Breachmap turns a real security incident into a sourced, interactive attack map:
one offline HTML file that shows how the attack happened, step by step, and how
to defend against it. The MVP proves the full pipeline end to end on 5 real incidents.

Terms:

- **Incident**: one JSON file that describes one attack.
- **Entity**: an attacker, victim or system involved in the incident.
- **Step**: one action in the attack, from one entity to another.
- **Source**: a public web page that backs a claim.
- **Primary source**: a source of type `advisory`, `cve`, `vendor` or `report`.
- **Map**: the HTML file rendered from a valid incident.

## 2. Problem

Write-ups of major incidents are long, scattered across advisories, blogs and news,
and hard to follow. Developers and security teams want to understand quickly how an
attack worked and what to do about it, with every claim traceable to a source.

## 3. Goals

- **G1**: Go from an incident name to a validated, rendered map with one agent command.
- **G2**: Every claim in a map is traceable to a cited source.
- **G3**: Maps are safe to open and share: offline, no network requests, no script injection.
- **G4**: The agent skill's accuracy is measured, not assumed.

## 4. Non-goals (MVP)

- Hosted website, user accounts or any backend
- Video or GIF export
- Visual editor
- Live threat-intelligence feeds
- Reproducing or testing attacks
- Languages other than English

## 5. Users

- **Developer / security engineer**: understand an incident quickly and share it with the team.
- **Educator / content creator**: use maps in talks, posts and videos.
- **Contributor**: add a new incident to the gallery.

## 6. User stories

- **US1**: As a developer, I ask my agent to "map the xz backdoor" and get a validated
  map file, so I can understand the attack in minutes.
- **US2**: As a reader, I select any step and see the sources behind it, so I can verify it.
- **US3**: As a contributor, I run `breachmap validate` and get exact errors with fixes,
  so I can submit a correct incident.
- **US4**: As a security lead, I read the defenses checklist, so I know what to check
  in our own systems.

## 7. Functional requirements

### 7.1 Incident data

- **FR-1**: An incident is one JSON file with `schemaVersion: 1`.
- **FR-2**: An incident contains:
  - `id`: lowercase slug, e.g. `xz-backdoor-2024`
  - `title`, and `summary` (max 500 characters)
  - `dates`: started, discovered, disclosed (ISO 8601 dates; each may be unknown)
  - `identifiers`: optional CVE IDs (format `CVE-YYYY-NNNN`, 4 or more digits at the end)
  - `entities`: attackers, victims and systems involved (`id`, `name`,
    `kind`: `attacker` | `victim` | `system`)
  - `steps`: ordered list, each with:
    - `id`, `title`, `description` (max 600 characters)
    - `phase`: one MITRE ATT&CK Enterprise tactic (ADR 0002)
    - `techniqueId`: optional MITRE ATT&CK technique ID, e.g. `T1195.002` (ADR 0002)
    - `from`, `to`: entity IDs
    - `confidence`: `confirmed` | `reported` | `disputed`
    - `sourceIds`: at least 1
  - `impact`: what was affected, with `sourceIds`
  - `defenses`: each with `id`, `action`, related `stepIds`, and `sourceIds` (at least 1)
  - `sources`: each with `id`, `url` (https), `title`, `publisher`,
    `type` (`advisory` | `cve` | `vendor` | `report` | `research` | `news`),
    and `retrievedAt` (ISO 8601 date)
  - `provenance`: `createdBy` (`human` | `skill`), `skillVersion` (required when
    `createdBy` is `skill`), `createdAt`, and optional `reviewedBy`
- **FR-3**: All text fields are plain text. No HTML, Markdown or code blocks.

### 7.2 Validation

- **FR-4**: Validation fails if any of these is true:
  - a field does not match the schema
  - a step, the impact, or a defense has no source
  - a `sourceIds`, `stepIds`, `from` or `to` value points to an ID that does not exist
  - an ID is used twice within the same list
  - a source is never referenced by a step, the impact or a defense
  - the incident has fewer than 2 sources, or no primary source
  - a URL does not use https
- **FR-5**: Every error states the file, the JSON path (e.g. `steps[3].sourceIds`),
  what is wrong, and how to fix it.
- **FR-6**: Validation is offline and deterministic. It does not check whether URLs are live.

### 7.3 Rendering

- **FR-7**: Rendering produces one self-contained HTML file from a valid incident.
  Invalid input is refused.
- **FR-8**: The map shows the title and summary, a step-by-step attack flow between
  entities (a sequence diagram, ADR 0003), the phase of each step, the impact, a defenses checklist, and the full source list.
- **FR-9**: Interaction: move between steps (buttons and arrow keys); selecting a step
  highlights it and its sources; each defense links to the steps it addresses.
- **FR-10**: Steps with confidence `reported` or `disputed` are visibly labeled.
- **FR-11**: Steps, sources and defenses are readable with JavaScript disabled.
- **FR-12**: The footer shows the schema version, provenance, and the Breachmap version.

### 7.4 CLI

- **FR-13**: `breachmap validate <file...>` exits 0 if all files are valid, 1 if any is invalid.
- **FR-14**: `breachmap render <file> [-o <out.html>]` validates first and exits 1 on invalid input.
- **FR-15**: `breachmap new <id>` creates a starter incident file with placeholder values.
- **FR-16**: Usage errors exit 2 with a help message. `--help` and `--version` work.

### 7.5 Agent skill

- **FR-17**: The skill follows the open Agent Skills format (`SKILL.md`) and works in Claude Code.
- **FR-18**: Input is an incident name, CVE ID or URL. Output is
  `gallery/incidents/<id>.json`, followed by validate and render. If validation fails,
  the skill fixes the file and retries up to 3 times, then stops and reports the errors.
- **FR-19**: Research rules:
  - prefer primary sources: advisories, CVE records, vendor and official reports
  - only use URLs that were actually retrieved; never invent or guess a URL
  - set `retrievedAt` to the date each source was retrieved
  - label attribution to a threat actor `reported` unless officially confirmed
  - write all text in its own words; never copy text from sources
- **FR-20**: If fewer than 2 usable sources are found, the skill stops and reports
  instead of producing a map.

### 7.6 Gallery

- **FR-21**: The gallery contains 5 incidents. Each is created with the skill and
  reviewed by a human (`reviewedBy` set) before merge:
  1. xz Utils backdoor (CVE-2024-3094)
  2. Log4Shell (CVE-2021-44228)
  3. SolarWinds Orion / SUNBURST (2020)
  4. MOVEit Transfer (CVE-2023-34362)
  5. GitHub MCP prompt-injection data leak (2025)
- **FR-22**: The rendered HTML for each incident is committed under `gallery/maps/`.

## 8. Non-functional requirements

- **NFR-1 Security**:
  - all incident text is escaped on output; incident data never goes into `innerHTML`
  - the CSP blocks all network requests (`default-src 'none'`) and allows only the
    file's own inline script and style, by hash (no `'unsafe-inline'`)
  - no external fonts, images or scripts
- **NFR-2 Determinism**: the same input and the same Breachmap version produce
  byte-identical HTML.
- **NFR-3 Purity**: schema, core and render do no I/O and never read the clock or
  random values. Dates come from the input.
- **NFR-4 Size**: each rendered map is at most 250 KB.
- **NFR-5 Browsers**: latest Chrome, Firefox and Safari, on desktop and mobile.
- **NFR-6 Accessibility**: fully keyboard-usable, visible focus, WCAG 2.2 AA contrast,
  and respects `prefers-reduced-motion`.
- **NFR-7 Performance**: validating and rendering one incident takes under 1 second on a laptop.
- **NFR-8 Quality**: `pnpm check` passes in CI; schema and core have at least 90% line
  coverage; render is covered by snapshot tests.
- **NFR-9 Supply chain**: npm release with provenance, lockfile committed, Dependabot enabled.

## 9. Content and safety policy

- Explain how attacks worked and how to defend against them. Never include exploit
  code, payloads, or step-by-step reproduction instructions.
- Summarize sources in our own words. Do not copy source text.
- Name a threat actor only when a cited source does, and label the confidence.
- Factual errors reported through the "Incorrect fact" issue template are fixed
  and re-reviewed.

## 10. Evals (skill accuracy)

Golden incidents are human-verified JSON files in `evals/golden/` (3 for the MVP;
they may overlap with the gallery). The skill runs on each, and the output is scored:

| ID | Metric | MVP target |
|----|--------|------------|
| E1 | Output passes validation | 100% |
| E2 | Source URLs that do not resolve (HTTP 2xx after redirects) | 0 |
| E3 | Steps whose claim is supported by their cited source (LLM grader, 20% human spot-check) | at least 90% |
| E4 | Golden steps covered by the output | at least 80% |

Results are saved in `evals/results/` with the skill version and the run date.

## 11. Acceptance criteria

The MVP is done when all of these pass:

- [ ] **AC1**: `breachmap validate` passes on all 5 gallery incidents and fails with the
  correct message on broken fixtures, one per FR-4 rule. (FR-4, FR-5)
- [ ] **AC2**: Every rendered gallery map opens offline in Chrome, Firefox and Safari
  and makes zero network requests. (FR-7, NFR-1, NFR-5)
- [ ] **AC3**: An incident whose text contains `<script>` and `<img onerror>` renders
  them as visible text, and nothing executes. (NFR-1)
- [ ] **AC4**: Rendering the same file twice produces identical bytes. (NFR-2)
- [ ] **AC5**: Steps, sources and defenses are readable with JavaScript disabled. (FR-11)
- [ ] **AC6**: The map is fully usable with the keyboard only. (FR-9, NFR-6)
- [ ] **AC7**: The skill produces a valid map for a new incident with one command in
  Claude Code. (FR-17 to FR-20)
- [ ] **AC8**: Evals meet all E1 to E4 targets. (Section 10)
- [ ] **AC9**: CI is green and architecture rules are enforced. (NFR-8)
- [ ] **AC10**: README has a GIF, a 3-step quickstart and a limitations section, and
  v0.1.0 is published to npm with provenance. (NFR-9)

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Wrong facts | Sources required, confidence labels, human review, evals |
| Wrong attribution to a threat actor | Only when a cited source states it, with confidence label |
| Copyright | Summaries in our own words, no copied text |
| Misuse as an attack guide | No exploit code, plain-text fields, policy in the skill |
| Scope creep | Non-goals in section 4; new ideas go into a new spec |
| Prompt injection in pages the skill reads | Skill treats page text as data, only writes the incident file, validation and human review gate it |
| Malicious incident file in a PR | All text escaped, strict CSP, no `innerHTML` (NFR-1) |

## 13. Decisions

The open questions are resolved:

- **Q1** npm naming: one unscoped `breachmap` package that bundles the internal packages.
  See [ADR 0001](../../docs/adr/0001-npm-package-naming.md).
- **Q2** ATT&CK: tactics required, technique IDs optional and checked by format only.
  See [ADR 0002](../../docs/adr/0002-attack-technique-ids.md).
- **Q3** Default view: a sequence diagram, which is a flow and a timeline in one.
  See [ADR 0003](../../docs/adr/0003-default-view-sequence-diagram.md).

## 14. Next steps

- How: [plan.md](plan.md)
- Work breakdown: [tasks.md](tasks.md)
