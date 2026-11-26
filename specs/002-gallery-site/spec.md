# Spec 002: Gallery site

| Field   | Value                  |
|---------|------------------------|
| Status  | Approved               |
| Author  | Shuja                  |
| Created | 2026-11-26             |
| Plan    | [plan.md](plan.md)     |

A public, zero-install showcase of the gallery on GitHub Pages, so a visitor sees a real attack
map in seconds. This moves "hosted website" out of the spec 001 non-goals, for the gallery only.

## Goals

- **G1**: One click from the README to a live map. No install, no sign-in.
- **G2**: A design that stands out by showing real data, not decoration.
- **G3**: The live site is as safe as the offline maps: strict CSP, no third-party requests.

## Requirements

- **FR-1**: A landing page lists every gallery incident as a card with its title, year, CVE,
  step count, share of confirmed steps, and a picture of its real attack shape (see plan).
- **FR-2**: Each card opens that incident's map. The five maps are the same files as `gallery/maps/`.
- **FR-3**: The landing page shows how maps are made: cited sources, human review, and the latest
  eval scores from `evals/results/`.
- **FR-4**: A short "make your own" section with the 3-step quickstart.
- **FR-5**: `pnpm site` builds the site into `site/` from the gallery files. CI deploys it to
  GitHub Pages on every push to `main`.
- **FR-6**: The README starts with a GIF of the site and a "Try it live" link.
- **NFR-1**: Same rules as the maps: everything escaped, CSP with `default-src 'none'`, no
  external fonts, scripts or images, readable without JavaScript, WCAG AA, keyboard usable.
- **NFR-2**: Deterministic: same gallery files give the same site bytes.

## Non-goals

- Search, accounts, comments, analytics or any backend.
- Changing the maps themselves (a separate spec if wanted).

## Acceptance criteria

- [ ] **AC1**: The site is live on GitHub Pages and makes zero third-party requests.
- [ ] **AC2**: Every card opens the right map; the page works with keyboard only and without JS.
- [ ] **AC3**: The README GIF shows the landing page and a map, with a working live link.
