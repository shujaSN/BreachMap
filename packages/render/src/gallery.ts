import { layout } from "@breachmap/core";
import { type Incident, TACTICS } from "@breachmap/schema";
import { type Html, html } from "./html.ts";
import { hashOf } from "./page.ts";

export type Evals = {
  date: string;
  skillVersion: string;
  E1: number;
  E2: number;
  E3: number;
  E4: number;
  provisional: boolean;
};
export type GalleryMeta = { version: string; evals?: Evals };

const CONFIDENCE = ["confirmed", "reported", "disputed"] as const;

export const GALLERY_CSS = html`:root{color-scheme:light dark;--bg:#f4f1ea;--card:#fbfaf6;--fg:#17181b;--muted:#55565b;--line:#85878c;--rule:#d8d4ca;--accent:#1f4fbf;--c1:#d8e1f5;--c2:#9db4e6;--reported:#8a4b00;--disputed:#b3261e;--serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#101113;--card:#17191c;--fg:#ecebe6;--muted:#a6a8ad;--line:#7c7f85;--rule:#2c2e33;--accent:#8fb0ff;--c1:#1f2a44;--c2:#34508f;--reported:#f2b866;--disputed:#f2a29b}}
*{box-sizing:border-box}
html{scroll-padding-top:4.5rem}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}
a{color:var(--accent)}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.wrap{max-width:76rem;margin:0 auto;padding:0 1.5rem}
.bar{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--rule)}
.bar .wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem 1.5rem;min-height:3.5rem}
.brand{font:700 .9rem/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--fg);text-decoration:none}
.brand::before{content:"";display:inline-block;width:.8em;height:.8em;margin-right:.6em;background:var(--accent);vertical-align:-.08em}
.bar nav{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem;font-size:.92rem}
.bar nav a{color:var(--fg);text-decoration:none}
.bar nav a:hover{text-decoration:underline}
.kicker,.no,.label,.case-meta,.strip-text,.counts{font-family:var(--mono);font-size:.75rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
h1,h2,h3{font-family:var(--serif);font-weight:600;line-height:1.08;letter-spacing:-.015em;text-wrap:balance}
.hero{padding:4rem 0 3.5rem}
.kicker{margin:0}
h1{font-size:clamp(2.5rem,7vw,5.5rem);margin:1rem 0 2.5rem}
.hero-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr));gap:2.5rem 4rem;align-items:end}
.lede{font-size:1.2rem;max-width:56ch;margin:0 0 2rem}
.actions{display:flex;flex-wrap:wrap;gap:1rem 1.75rem;align-items:center;margin:0}
.button{display:inline-block;padding:.75rem 1.25rem;background:var(--fg);color:var(--bg);font-weight:600;text-decoration:none}
.button:hover{background:var(--accent)}
.totals{display:grid;grid-template-columns:repeat(2,1fr);margin:0;border-top:1px solid var(--rule);color:var(--muted)}
.totals span{padding:1.1rem 0 1.1rem 1.25rem;border-bottom:1px solid var(--rule)}
.totals span:nth-child(odd){padding-left:0;border-right:1px solid var(--rule)}
.totals b{display:block;font:600 2.75rem/1 var(--serif);color:var(--fg);margin-bottom:.35rem}
section{padding:4rem 0;border-top:1px solid var(--rule)}
h2{display:flex;gap:1rem;align-items:baseline;font-size:2.1rem;margin:0 0 .75rem}
.no{color:var(--accent);letter-spacing:.12em}
.intro{max-width:64ch;color:var(--muted);margin:0 0 2.25rem}
.scroll{overflow-x:auto;padding-bottom:.5rem}
.matrix{border-collapse:collapse;font-size:.85rem}
.matrix thead th{height:10.5rem;padding:0 0 .6rem;vertical-align:bottom;font-weight:500;color:var(--muted)}
.matrix thead span{display:inline-block;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap}
.matrix tbody th{position:sticky;left:0;z-index:1;padding:0 1.5rem 0 0;background:var(--bg);text-align:left;font-weight:500;white-space:nowrap}
.matrix tbody th a{color:var(--fg);text-decoration:none}
.matrix tbody th a:hover{text-decoration:underline}
.matrix .label{margin-right:.75rem}
.matrix thead td{border:0}
.matrix td{width:2.5rem;min-width:2.5rem;height:2.5rem;border:1px solid var(--rule);text-align:center;font:600 .85rem var(--mono)}
@media (max-width:40rem){.matrix tbody th{min-width:9rem;padding-right:.75rem;white-space:normal}.matrix td{width:1.9rem;min-width:1.9rem}}
.c1{background:var(--c1)}
.c2{background:var(--c2)}
.c3{background:var(--accent);color:var(--bg)}
.legend{display:flex;flex-wrap:wrap;gap:.5rem 1.25rem;align-items:center;margin:1.25rem 0 0}
.legend i{display:inline-block;width:.9rem;height:.9rem;margin-right:.4rem;border:1px solid var(--rule);vertical-align:-.15em}
.cases{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr));gap:1.5rem}
.case{position:relative;display:flex;flex-direction:column;gap:.85rem;padding:1.35rem;background:var(--card);border:1px solid var(--rule)}
.case:hover{border-color:var(--fg)}
.case:has(a:focus-visible){outline:3px solid var(--accent);outline-offset:2px}
.case a:focus-visible{outline:none}
.case-meta{display:flex;flex-wrap:wrap;gap:.25rem 1rem;margin:0}
.case h3{font-size:1.5rem;margin:0}
.case h3 a{color:var(--fg);text-decoration:none}
.case h3 a::after{content:"";position:absolute;inset:0}
.case:hover h3 a{text-decoration:underline}
.mini{display:block;width:100%;height:8.5rem;background:var(--bg);border:1px solid var(--rule)}
.mini .lane{stroke:var(--line);stroke-width:1;stroke-dasharray:2 3;vector-effect:non-scaling-stroke}
.mini .s line{stroke:var(--fg);stroke-width:2;vector-effect:non-scaling-stroke}
.mini .s circle{fill:var(--fg)}
.mini .reported line{stroke:var(--reported);stroke-dasharray:4 3}
.mini .reported circle{fill:var(--reported)}
.mini .disputed line{stroke:var(--disputed);stroke-dasharray:1 3}
.mini .disputed circle{fill:var(--disputed)}
.sum{margin:0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;line-clamp:4;overflow:hidden}
.strip{display:flex;gap:3px;margin:auto 0 0}
.strip span{flex:1;height:.45rem;background:var(--fg)}
.strip .reported{background:var(--reported)}
.strip .disputed{background:var(--disputed)}
.strip-text{margin:0}
.counts{display:flex;flex-wrap:wrap;gap:.2rem 1.1rem;margin:0}
.open{margin:0;font-weight:600;color:var(--accent)}
.how{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr));gap:2rem 2.5rem;margin:0}
.how dt{font:600 1.3rem/1.2 var(--serif);margin:0 0 .5rem}
.how dd{margin:0;color:var(--muted)}
.evals{margin-top:3rem;padding:1.5rem 1.75rem;background:var(--card);border:1px solid var(--rule)}
.evals h3{font-size:1.3rem;margin:0 0 .35rem}
.evals p{margin:0;color:var(--muted)}
.scores{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr));gap:1.5rem;margin:1.5rem 0 0;padding:0;list-style:none;color:var(--muted);font-size:.9rem}
.scores b{display:block;margin-bottom:.4rem;font:600 2.25rem/1 var(--serif);color:var(--fg)}
.make{margin:0;padding:0 0 0 1.5rem;max-width:52rem}
.make li{margin:0 0 1.5rem;padding-left:.5rem}
.make li::marker{font:600 1.1rem var(--serif);color:var(--accent)}
pre{margin:.6rem 0 0;padding:1rem 1.15rem;overflow-x:auto;background:var(--fg);color:var(--bg);font:.88rem/1.6 var(--mono)}
code{font-family:var(--mono);font-size:.9em}
footer{padding:0 0 3rem;color:var(--muted);font-size:.88rem}
footer .wrap{padding-top:2rem;border-top:1px solid var(--rule)}
footer p{margin:0}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}`;

const CSP = [
  "default-src 'none'",
  `style-src ${hashOf(GALLERY_CSS)}`,
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const when = ({ dates: d }: Incident) => d.disclosed ?? d.discovered ?? d.started ?? "";
const short = (title: string) => title.split(/: | \(/, 1)[0] || title;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const REPO = "https://github.com/shujaSN/BreachMap";
const noun = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;
const plural = (n: number, word: string) => `${n} ${noun(n, word)}`;
const stat = (n: number, word: string) => html`<span><b>${n}</b> ${noun(n, word)}</span>`;
const two = (i: number) => String(i + 1).padStart(2, "0");

function mini(incident: Incident): Html {
  const g = layout(incident);
  const x = new Map(g.lanes.map((lane, i) => [lane.x, 10 + 48 * i]));
  const width = 20 + 48 * (g.lanes.length - 1);
  const height = 20 + 10 * (g.rows.length - 1);
  const confidence = new Map(incident.steps.map((s) => [s.id, s.confidence]));
  const lanes = g.lanes.map(
    (lane) =>
      html`<line class="lane" x1="${x.get(lane.x)}" y1="0" x2="${x.get(lane.x)}" y2="${height}"></line>`,
  );
  const steps = g.rows.map((r, j) => {
    const [x1, x2, y] = [x.get(r.x1) ?? 0, x.get(r.x2) ?? 0, 10 + 10 * j];
    return html`<g class="s ${confidence.get(r.stepId)}">${x1 !== x2 && html`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"></line>`}<circle cx="${x1}" cy="${y}" r="1.5"></circle><circle cx="${x2}" cy="${y}" r="3"></circle></g>`;
  });
  return html`<svg class="mini" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${lanes}${steps}</svg>`;
}

function card(incident: Incident, i: number): Html {
  const { id, steps, provenance: p } = incident;
  const tally = CONFIDENCE.map((c) => [c, steps.filter((s) => s.confidence === c).length] as const)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${n} ${c}`)
    .join(" · ");
  return html`
<li class="case">
<p class="case-meta"><span>Case ${two(i)}</span> <span>${when(incident).slice(0, 4) || "Unknown"}</span>${incident.identifiers?.cve.map((c) => html` <span>${c}</span>`)}</p>
<h3><a href="maps/${id}.html"><bdi>${incident.title}</bdi></a></h3>
${mini(incident)}
<p class="sum">${incident.summary}</p>
<p class="strip" aria-hidden="true">${steps.map((s) => html`<span class="${s.confidence}"></span>`)}</p>
<p class="strip-text">${tally}</p>
<p class="counts"><span>${plural(steps.length, "step")}</span> <span>${plural(incident.sources.length, "source")}</span> <span>${plural(incident.defenses.length, "defense")}</span> <span>${p.reviewedBy ? html`Reviewed by <bdi>${p.reviewedBy}</bdi>` : "Not reviewed yet"}</span></p>
<p class="open" aria-hidden="true">Open map →</p>
</li>`;
}

function row(incident: Incident, i: number): Html {
  const used = new Map<string, number>();
  for (const s of incident.steps) used.set(s.phase, (used.get(s.phase) ?? 0) + 1);
  const cells = Object.entries(TACTICS).map(([key, tactic]) => {
    const n = used.get(key) ?? 0;
    return n
      ? html`<td class="c${Math.min(n, 3)}" title="${tactic.name}: ${plural(n, "step")}">${n}</td>`
      : html`<td></td>`;
  });
  return html`
<tr><th scope="row"><span class="label">${two(i)}</span><a href="maps/${incident.id}.html"><bdi>${short(incident.title)}</bdi></a></th>${cells}</tr>`;
}

function evals(e: Evals): Html {
  return html`
<div class="evals" id="evals">
<h3>Skill evals</h3>
<p>Run on ${e.date} with skill ${e.skillVersion}.${e.provisional ? " Provisional: the reference answers are not reviewed yet." : ""}</p>
<ul class="scores">
<li><b>${pct(e.E1)}</b> of outputs pass validation</li>
<li><b>${e.E2}</b> broken links</li>
<li><b>${pct(e.E3)}</b> of steps backed by their source (model-graded)</li>
<li><b>${pct(e.E4)}</b> of known steps covered</li>
</ul>
</div>`;
}

export function renderGallery(incidents: readonly Incident[], meta: GalleryMeta): string {
  const list = [...incidents].sort((a, b) => compare(when(b), when(a)) || compare(a.id, b.id));
  const total = (count: (i: Incident) => number) => list.reduce((n, i) => n + count(i), 0);
  const reviewed = total((i) => (i.provenance.reviewedBy ? 1 : 0));
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">
<meta http-equiv="x-dns-prefetch-control" content="off">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Real security incidents mapped step by step, with a cited source for every step. Each map is one offline HTML file.">
<title>Breachmap · Real attacks, mapped step by step</title>
<style>${GALLERY_CSS}</style>
</head>
<body>
<header class="bar"><div class="wrap"><a class="brand" href="#top">Breachmap</a>
<nav aria-label="Sections"><a href="#shapes">Shapes</a><a href="#cases">Cases</a><a href="#method">Method</a><a href="#make">Make one</a><a href="${REPO}" rel="noopener noreferrer">GitHub</a></nav></div></header>
<main class="wrap" id="top">
<div class="hero">
<p class="kicker">Open-source attack maps</p>
<h1>How real breaches happened, step by step.</h1>
<div class="hero-grid">
<div>
<p class="lede">Breachmap turns a security incident into one offline HTML page: who did what to whom, in order, mapped to MITRE ATT&amp;CK, with a cited source for every step and the defenses that address them.</p>
<p class="actions"><a class="button" href="#cases">See the ${plural(list.length, "case")}</a><a href="${REPO}" rel="noopener noreferrer">Source on GitHub</a></p>
</div>
<p class="totals">${stat(list.length, "incident")} ${stat(
    total((i) => i.steps.length),
    "step",
  )} ${stat(
    total((i) => i.sources.length),
    "source",
  )} ${stat(
    total((i) => i.defenses.length),
    "defense",
  )}</p>
</div>
</div>
<section id="shapes" aria-labelledby="shapes-title">
<h2 id="shapes-title"><span class="no">01</span> Attack shapes</h2>
<p class="intro">Each row is one incident. The columns are the 15 MITRE ATT&amp;CK tactics, in order. A number counts the steps in that tactic, so each attack leaves its own shape.</p>
<div class="scroll" role="region" aria-label="Attack shapes table" tabindex="0">
<table class="matrix">
<thead><tr><td></td>${Object.values(TACTICS).map((t) => html`<th scope="col"><span>${t.name}</span></th>`)}</tr></thead>
<tbody>${list.map(row)}
</tbody>
</table>
</div>
<p class="legend label"><span><i class="c1"></i>1 step</span><span><i class="c2"></i>2 steps</span><span><i class="c3"></i>3 or more</span></p>
</section>
<section id="cases" aria-labelledby="cases-title">
<h2 id="cases-title"><span class="no">02</span> Cases</h2>
<p class="intro">Open a case to step through the attack. Solid lines are confirmed by a primary source, dashed lines are only reported, and dotted lines are disputed.</p>
<ol class="cases">${list.map(card)}
</ol>
</section>
<section id="method" aria-labelledby="method-title">
<h2 id="method-title"><span class="no">03</span> How a map is made</h2>
<p class="intro">Four rules keep every map honest.</p>
<dl class="how">
<div><dt>Sourced</dt><dd>Every step cites its sources, and every map needs a primary one: an advisory, CVE record, vendor or incident report.</dd></div>
<div><dt>Checked</dt><dd>A strict validator checks every id, and that every link is https, before a map is drawn. A broken file is refused with a fix, never drawn half right.</dd></div>
<div><dt>Reviewed</dt><dd>A map is a draft until a person checks it against its sources. ${reviewed} of ${list.length} reviewed so far.</dd></div>
<div><dt>Safe to open</dt><dd>One offline file with a strict content policy. No network requests, no tracking, and all incident text is escaped.</dd></div>
</dl>${meta.evals && evals(meta.evals)}
</section>
<section id="make" aria-labelledby="make-title">
<h2 id="make-title"><span class="no">04</span> Make your own</h2>
<p class="intro">Map any public incident in three steps.</p>
<ol class="make">
<li>Get the code. Needs Node 26 and pnpm 12.<pre><code>git clone ${REPO}
cd BreachMap &amp;&amp; pnpm install</code></pre></li>
<li>In Claude Code, in the repo, ask “map the xz backdoor”. The <code>breachmap</code> skill researches it and writes <code>gallery/incidents/&lt;id&gt;.json</code>. No agent? <code>pnpm breachmap new my-incident</code> writes <code>my-incident.json</code> to fill in.</li>
<li>Check it and draw it.<pre><code>pnpm breachmap validate &lt;file&gt;.json
pnpm breachmap render &lt;file&gt;.json -o map.html</code></pre></li>
</ol>
</section>
</main>
<footer><div class="wrap"><p>Breachmap ${meta.version} · MIT license · <a href="${REPO}" rel="noopener noreferrer">Source on GitHub</a> · Explains attacks and defenses only. No exploit code.</p></div></footer>
</body>
</html>
`.html;
}
