# ADR 0001: Publish one unscoped `breachmap` package

- Status: Accepted
- Date: 2026-11-24
- Resolves: spec 001, Q1

## Context

The workspace has 4 packages: schema, core, render and cli. Users only need the CLI,
and the agent skill only calls the CLI. Scoped `@breachmap/*` packages need an npm
organization, 4 releases per version, and release tooling to keep versions in sync.

## Decision

- Publish one package, `breachmap`, from `packages/cli`.
- Bundle schema, core, render and Zod into `dist/cli.js` with esbuild. The published
  package has zero runtime dependencies.
- Workspace packages keep the names `@breachmap/schema`, `@breachmap/core` and
  `@breachmap/render`. They are `private: true` and never published, so no npm org is needed.
- Rename the root package to `breachmap-workspace` so the name `breachmap` is unique.

## Consequences

- `npx breachmap` works with one install. One version and one provenance attestation per release.
- No library API on npm in the MVP. If we need one later, we write a new ADR.
- The name must still be free on npm. We check this right before the first publish.

## Alternatives

- Scoped `@breachmap/*` packages: needs an org, 4 releases and extra tooling. Rejected for the MVP.
- Unscoped package without bundling: would force us to publish the internal packages too.
