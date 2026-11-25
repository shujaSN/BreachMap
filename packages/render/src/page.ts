import { createHash } from "node:crypto";
import { type Incident, TACTICS } from "@breachmap/schema";
import { CSS, SCRIPT } from "./assets.ts";
import { type Html, html } from "./html.ts";

type Step = Incident["steps"][number];

const hashOf = (asset: Html) =>
  `'sha256-${createHash("sha256").update(asset.html).digest("base64")}'`;

const CSP = [
  "default-src 'none'",
  `script-src ${hashOf(SCRIPT)}`,
  `style-src ${hashOf(CSS)}`,
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const BADGE = { reported: "Reported", disputed: "Disputed" } as const;

const technique = (id: string | undefined) =>
  id &&
  html` <a class="technique" href="${`https://attack.mitre.org/techniques/${id.replace(".", "/")}/`}" rel="noopener noreferrer">${id}</a>`;

const badge = (confidence: Step["confidence"]) =>
  confidence !== "confirmed" &&
  html` <span class="badge ${confidence}">${BADGE[confidence]}</span>`;

export function page(incident: Incident, version: string): Html {
  const { dates, provenance: p } = incident;
  const sourceNumber = new Map(incident.sources.map((s, i) => [s.id, i + 1]));
  const stepNumber = new Map(incident.steps.map((s, i) => [s.id, i + 1]));
  const name = new Map(incident.entities.map((e) => [e.id, e.name]));

  const cites = (ids: readonly string[]) =>
    html`Sources:${ids.map((id) => html` <a href="#src-${id}">[${sourceNumber.get(id)}]</a>`)}`;

  const fact = (label: string, value: string | null) =>
    html`<div><dt>${label}</dt><dd>${value ?? "Unknown"}</dd></div>`;

  const step = (s: Step, i: number) => html`
<li class="step" id="step-${s.id}" data-sources="${s.sourceIds.map((id) => `src-${id}`).join(" ")}">
<h3><span class="n">${i + 1}</span> <bdi>${s.title}</bdi></h3>
<p class="meta"><span class="phase">${TACTICS[s.phase].name}</span>${technique(s.techniqueId)}${badge(s.confidence)}</p>
<p class="actors"><bdi>${name.get(s.from)}</bdi> → <bdi>${name.get(s.to)}</bdi></p>
<p>${s.description}</p>
<p class="cites">${cites(s.sourceIds)}</p>
</li>`;

  const addresses = (ids: readonly string[]) =>
    ids.length > 0 &&
    html`Addresses: ${ids.map((id, i) => html`${i ? ", " : ""}<a href="#step-${id}">Step ${stepNumber.get(id)}</a>`)} · `;

  const made =
    p.createdBy === "skill"
      ? `Created by the Breachmap skill ${p.skillVersion} on ${p.createdAt}`
      : `Created by hand on ${p.createdAt}`;

  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">
<meta http-equiv="x-dns-prefetch-control" content="off">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${incident.title} · Breachmap</title>
<style>${CSS}</style>
</head>
<body>
<header class="top">
<p class="kicker">Breachmap attack map</p>
<h1>${incident.title}</h1>
<p class="summary">${incident.summary}</p>
<dl class="facts">
${fact("Started", dates.started)}
${fact("Discovered", dates.discovered)}
${fact("Disclosed", dates.disclosed)}
${incident.identifiers && fact("CVE", incident.identifiers.cve.join(", "))}
</dl>
</header>
<main>
<section id="flow" aria-labelledby="flow-title">
<h2 id="flow-title">Attack flow</h2>
<ol class="steps">${incident.steps.map(step)}
</ol>
</section>
<section id="impact" aria-labelledby="impact-title">
<h2 id="impact-title">Impact</h2>
<p>${incident.impact.description}</p>
<p class="cites">${cites(incident.impact.sourceIds)}</p>
</section>
<section id="defenses" aria-labelledby="defenses-title">
<h2 id="defenses-title">Defenses</h2>
<ul class="checklist">${incident.defenses.map(
    (d) => html`
<li id="def-${d.id}"><label><input type="checkbox"> <span>${d.action}</span></label>
<p class="cites">${addresses(d.stepIds)}${cites(d.sourceIds)}</p></li>`,
  )}
</ul>
</section>
<section id="sources" aria-labelledby="sources-title">
<h2 id="sources-title">Sources</h2>
<ol class="sources">${incident.sources.map(
    (s) => html`
<li id="src-${s.id}"><a href="${new URL(s.url).href}" rel="noopener noreferrer"><bdi>${s.title}</bdi></a> <span class="source-meta"><bdi>${s.publisher}</bdi> · ${s.type} · retrieved ${s.retrievedAt}</span></li>`,
  )}
</ol>
</section>
</main>
<footer>
<p>Schema version ${incident.schemaVersion} · ${made} · ${p.reviewedBy ? html`Reviewed by <bdi>${p.reviewedBy}</bdi>` : "Not reviewed yet"} · Made with Breachmap ${version}</p>
</footer>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
