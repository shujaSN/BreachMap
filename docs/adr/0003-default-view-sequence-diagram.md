# ADR 0003: Default view is a sequence diagram

- Status: Accepted
- Date: 2026-11-24
- Resolves: spec 001, Q3

## Context

The question was flow diagram or timeline. Steps are ordered, but they have no dates
of their own. Each step goes from one entity to another. The view must work without
JavaScript (FR-11), be deterministic (NFR-2) and stay small (NFR-4).

## Decision

Use a sequence diagram (swimlanes). It is a flow and a timeline in one:

- One column per entity, one row per step, top to bottom.
- Each step is a numbered arrow from `from` to `to`. When `from` equals `to`, it is a dot on that lane.
- Lanes are ordered by first appearance in the steps. Unused entities go last.
- Layout is a pure function in core with fixed lane width, fixed row height and integer coordinates.
- Rendered as inline SVG next to the step list (above it on small screens) and kept in sync with it.

## Consequences

- Shows both who did what and in which order.
- No layout library. Deterministic and tiny.
- Readable with JavaScript disabled.
- Many entities make it wide. Small screens scroll sideways. The skill keeps entities to 6 or fewer.
- It does not show time between steps. Incident dates are shown in the header.

## Alternatives

- Graph flow diagram: needs a layout library, repeated arrows between the same
  entities overlap, and stable output is harder.
- Timeline: steps have no dates, and it loses who acted on whom.
