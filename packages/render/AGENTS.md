# Render

Turns a validated incident into one offline HTML file. Pure and deterministic.

## Files
- `render.ts`: `render(input, { version })` validates with core and returns `Result<string, Issue[]>`.
  It refuses maps over 250 KB (ADR 0004).
- `page.ts`: the page: head with CSP, header, flow, impact, defenses, sources, footer.
- `diagram.ts`: the SVG sequence diagram from core `layout()`.
- `assets.ts`: the fixed CSS and script. Their sha256 hashes go into the CSP.
- `html.ts`: the escaping `html` template. The only way to build HTML.
- `bidi.ts`: `isolate()` keeps incident text from reordering fixed text where `<bdi>` cannot go.

## Rules
- Build all HTML with `html`. Never join strings into HTML. Never use `innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, `document.write`, `eval`, `new Function` or string timers.
- Put incident values only in text or in a double-quoted allowed attribute. No fixed `style=` or
  `on*=` attributes either (the CSP would block them).
- Links: in-page links go to `#step-${id}` or `#src-${id}`. External `href`s come only from
  schema-checked source URLs (normalized with `new URL(url).href`) or checked technique ids, and
  always have `rel="noopener noreferrer"`.
- Ids from incident data get a prefix: `step-`, `src-`, `def-`. Fixed ids must not use those
  prefixes (the controls use `nav-`).
- Wrap inline incident text that sits next to fixed text in `<bdi>`. Where markup is not allowed
  (`<title>`), wrap it with `isolate()` from `bidi.ts`.
- Keep the head order: charset, then the CSP meta with exactly `default-src 'none'`, script and
  style by sha256 hash, `base-uri 'none'`, `form-action 'none'` (never `'unsafe-*'` or hosts),
  then the referrer and DNS-prefetch metas. Put nothing between `<style>`/`<script>` and the asset:
  the hash covers the exact bytes.
- CSS and script are value-free `html` templates: no `${}`, backticks, backslashes, `</script`,
  `</style` or `<!--`. The script uses only `window` and `document`.
- No network: no `src`, `<link>`, `@import`, web fonts, or `url(` other than `url(#arrowhead)`.
- Same input and version give the same bytes. Update the snapshot (`pnpm test -u`) only for an
  intended output change.

## Tests
- `html.test.ts`: escaping and the template grammar.
- `render.test.ts`: page structure, CSP and the file snapshot.
- `diagram.test.ts`, `script.test.ts` (runs the script in happy-dom), `assets.test.ts` (contrast).
- `safety.test.ts`: AC3 (XSS), AC4 (same bytes), no network, size and speed budgets.
