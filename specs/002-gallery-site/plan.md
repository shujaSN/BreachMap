# Plan 002: Gallery site

How we build [spec 002](spec.md).

## Design: "case file", not "AI landing page"

No gradients, glass, glow, emoji, stock icons or vague hero copy. The visuals are the data:

- **Attack fingerprint**: a strip of the 15 ATT&CK tactics in matrix order. Cells a step uses are
  filled, darker when used more often. Each incident gets a unique, honest signature.
- **Mini diagram**: a small, real copy of the incident's sequence diagram, drawn from `layout()`.
- **Confidence bar**: confirmed vs reported vs disputed steps, as one thin bar with numbers.
- Editorial layout: system fonts only (serif headings, sans text, mono labels), tight grid,
  case-file labels (`CASE 03 2023 CVE-2023-34362`), ink on paper in light mode, light on ink in
  dark mode, one accent color for links, focus, section numbers and the matrix scale.

## Build

- `packages/render/src/gallery.ts`: `renderGallery(incidents, meta)` returns the landing page,
  built with the same `html` template, CSS rules and CSP hashing as the maps. Pure, no script.
  Not exported from the render index, so the CLI bundle stays small.
- `scripts/build-site.ts` (`pnpm site`): reads `gallery/incidents/*.json` and the latest
  `evals/results/*.json` (by file name), renders each map and fails if it differs from
  `gallery/maps/<id>.html`, then writes `site/index.html` and `site/maps/`. `site/` is gitignored.
- `ci.yml`: every run builds the site. On push to `main`, after all checks pass, a clean `site`
  job rebuilds it (no dev tools run first) and a `pages` job deploys it with the official Pages
  actions, pinned by SHA, with `pages: write` and `id-token: write` only in that job. Runs on
  `main` queue in order.
- GIF: headless Chrome records the landing page, a click into a map and a few steps; ffmpeg makes
  `docs/demo.gif`. The README gets the GIF and a "Try it live" link at the top.

## Tests

- Landing page: every incident has a card with the right facts and link; fingerprint cells match
  the incident's tactics; escaping (xss fixture as a card); CSP hashes; no external references;
  same bytes twice; no `hidden` content.
- Build script: writes index and five maps; fails if a map is missing.

## Needs Shuja

- Make the repo public (Pages needs it on a free plan) and set Pages source to "GitHub Actions".
