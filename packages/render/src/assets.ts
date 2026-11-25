import { html } from "./html.ts";

export const CSS = html`:root{color-scheme:light dark;--bg:#ffffff;--card:#f4f5f7;--fg:#1b1c1e;--muted:#4b4f56;--line:#767a80;--accent:#0b57d0;--accent-bg:#e3ecfb;--reported:#8a4b00;--disputed:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#121316;--card:#1d1f23;--fg:#e9eaec;--muted:#b4b8bf;--line:#8e939a;--accent:#8ab4f8;--accent-bg:#1e2a3f;--reported:#f2b866;--disputed:#f2a29b}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}
header.top,main,footer{max-width:72rem;margin:0 auto;padding:1.5rem}
h1{font-size:1.9rem;line-height:1.2;margin:.25rem 0 .75rem}
h2{font-size:1.35rem;margin:2rem 0 1rem}
h3{font-size:1.05rem;margin:0 0 .35rem}
.kicker{margin:0;color:var(--muted);font-size:.85rem;text-transform:uppercase;letter-spacing:.06em}
.summary{max-width:60ch;font-size:1.1rem}
.facts{display:flex;flex-wrap:wrap;gap:.5rem 2rem;margin:1rem 0 0}
.facts dt{color:var(--muted);font-size:.8rem}
.facts dd{margin:0;font-weight:600}
a{color:var(--accent)}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
#flow{display:grid;gap:1rem 2rem}
@media (min-width:60rem){#flow{grid-template-columns:minmax(0,max-content) minmax(22rem,1fr);align-items:start}#flow h2,#flow .controls{grid-column:1/-1}.diagram{position:sticky;top:1rem;max-height:calc(100vh - 2rem)}}
.diagram{margin:0;overflow:auto;background:var(--card);border-radius:8px;padding:.5rem}
.diagram svg{display:block}
.lane-label{fill:var(--fg);font-size:13px;font-weight:600;text-anchor:middle}
.lifeline{stroke:var(--line);stroke-width:1.5;stroke-dasharray:3 5}
.arrow line{stroke:var(--fg);stroke-width:2}
.arrow circle{fill:var(--fg)}
#arrowhead path{fill:var(--fg);fill:context-stroke}
.arrow.reported line{stroke:var(--reported);stroke-dasharray:8 5}
.arrow.reported circle{fill:var(--reported)}
.arrow.disputed line{stroke:var(--disputed);stroke-dasharray:2 4}
.arrow.disputed circle{fill:var(--disputed)}
.step-n{fill:var(--fg);font-size:12px;font-weight:700;text-anchor:middle}
.arrow[aria-current=step] line{stroke:var(--accent);stroke-width:4}
.arrow[aria-current=step] circle,.arrow[aria-current=step] .step-n{fill:var(--accent)}
.steps{list-style:none;margin:0;padding:0}
.step{background:var(--card);border-left:4px solid transparent;border-radius:6px;margin:0 0 .75rem;padding:.75rem 1rem;scroll-margin:1rem}
.step:target,.step[aria-current=step]{border-left-color:var(--accent)}
.n{display:inline-block;min-width:1.7em;margin-right:.35rem;border-radius:999px;background:var(--accent);color:var(--bg);text-align:center;font-size:.85rem}
.meta,.cites,.actors{margin:.25rem 0;color:var(--muted);font-size:.9rem}
.technique{margin-left:.4rem}
.badge{margin-left:.4rem;padding:0 .4rem;border:1px solid currentColor;border-radius:4px;font-weight:600}
.badge.reported{color:var(--reported)}
.badge.disputed{color:var(--disputed)}
.checklist{list-style:none;padding:0}
.checklist li{margin:0 0 .75rem}
.checklist label{display:flex;gap:.6rem;align-items:flex-start;font-weight:600}
.checklist input{width:1.15rem;height:1.15rem;margin-top:.2rem;accent-color:var(--accent)}
.sources{padding-left:1.5rem}
.sources li{margin:0 0 .5rem;padding:.2rem .4rem;border-radius:4px;scroll-margin:1rem}
.sources li:target,.sources li.hl{background:var(--accent-bg)}
.source-meta{color:var(--muted);font-size:.9rem}
.controls{display:none}
.js .controls{display:flex;gap:.75rem;align-items:center}
.controls button{font:inherit;padding:.35rem .9rem;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg);cursor:pointer}
.controls button:disabled{opacity:.5;cursor:default}
footer{color:var(--muted);font-size:.85rem;border-top:1px solid var(--line)}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}`;

export const SCRIPT = html`document.documentElement.classList.add("js");`;
