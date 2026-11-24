# ADR 0002: Include optional ATT&CK technique IDs, checked by format only

- Status: Accepted
- Date: 2026-11-24
- Resolves: spec 001, Q2

## Context

Every step needs one ATT&CK tactic (`phase`). A technique ID adds precision for
defenders, but a wrong ID is a wrong claim. The full ATT&CK dataset is large and
changes about twice a year. ATT&CK v20.1 has 15 Enterprise tactics; v19 split
Defense Evasion into Stealth and Defense Impairment.

## Decision

- Keep `techniqueId` optional in the MVP, as FR-2 already says.
- Validate its format only: `T` + 4 digits, optionally `.` + 3 digits (e.g. `T1195.002`).
- Do not bundle the ATT&CK catalogue.
- `phase` is one of the 15 ATT&CK v20 Enterprise tactics, stored as a slug:
  `reconnaissance`, `resource-development`, `initial-access`, `execution`, `persistence`,
  `privilege-escalation`, `stealth`, `defense-impairment`, `credential-access`, `discovery`,
  `lateral-movement`, `collection`, `command-and-control`, `exfiltration`, `impact`.
- The map shows the technique ID as a link to its page on attack.mitre.org.
- The skill sets a technique only when it is sure. Tactic alone is always fine.

## Consequences

- Richer maps now, and no schema change later to add techniques.
- A well-formed but unknown ID (e.g. `T9999`) passes validation. Human review and evals catch it.
- If ATT&CK changes its tactics, we change the schema with a new ADR.

## Alternatives

- Tactics only: simpler, but loses precision the skill can often provide.
- Bundle the ATT&CK catalogue: exact checks, but adds data to maintain and goes stale.
