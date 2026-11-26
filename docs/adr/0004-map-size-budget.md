# ADR 0004: Enforce the 250 KB map budget at render time

- Status: Accepted
- Date: 2026-11-26
- Resolves: NFR-4 for large valid incidents

## Context

NFR-4 says each rendered map is at most 250 KB. The schema limits text lengths but not list
lengths, and non-Latin text and escaped characters such as `&` take more bytes. A valid incident
with 60 steps of CJK text renders to about 335 KB. Real incidents render to 21–32 KB.

## Decision

- `render()` measures the finished HTML in UTF-8 bytes. Over 250,000 bytes, it returns an `Issue`
  at `(root)`: "makes a N KB map; the limit is 250 KB", with a fix to shorten or split.
- The CLI reports it like any other issue and exits 1.
- The schema does not change.

## Consequences

- NFR-4 holds for every map that renders, measured exactly.
- A valid incident can still be refused by `render`. The message says why and how to fix it.
- `validate` does not predict the size. Only `render` knows it.

## Alternatives

- List caps in the schema: only approximate the limit, and need a schema version change.
- Warn but still write the map: breaks NFR-4.
