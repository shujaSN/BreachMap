import { layout } from "@breachmap/core";
import type { Incident } from "@breachmap/schema";
import { isolate } from "./bidi.ts";
import { type Html, html } from "./html.ts";

const SUFFIX = { confirmed: "", reported: " (reported)", disputed: " (disputed)" } as const;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const short = (name: string) => {
  const chars = [...name];
  return chars.length > 20 ? `${chars.slice(0, 19).join("")}…` : name;
};

export function diagram(incident: Incident): Html {
  const g = layout(incident);
  const names = new Map(incident.entities.map((e) => [e.id, e.name]));
  const lanes = g.lanes.map((lane) => {
    const name = names.get(lane.entityId) ?? "";
    return html`
<g class="lane"><title>${name}</title><text class="lane-label" x="${lane.x}" y="${g.top - 28}">${short(name)}</text><line class="lifeline" x1="${lane.x}" y1="${g.top}" x2="${lane.x}" y2="${g.bottom}"></line></g>`;
  });
  const steps = new Map(incident.steps.map((s) => [s.id, s]));
  const arrows = g.rows.map((r) => {
    const step = steps.get(r.stepId);
    if (!step) return "";
    const self = r.x1 === r.x2;
    const mark = self
      ? html`<circle cx="${r.x1}" cy="${r.y}" r="6"></circle>`
      : html`<line x1="${r.x1}" y1="${r.y}" x2="${r.x2}" y2="${r.y}" marker-end="url(#arrowhead)"></line>`;
    return html`
<a class="arrow ${step.confidence}" href="#step-${step.id}" data-step="step-${step.id}" tabindex="-1"><title>Step ${r.n}: ${isolate(step.title)}${SUFFIX[step.confidence]}</title>${mark}<text class="step-n" x="${self ? r.x1 + 14 : (r.x1 + r.x2) / 2}" y="${r.y - 8}">${r.n}</text></a>`;
  });
  return html`<figure class="diagram">
<svg viewBox="0 0 ${g.width} ${g.height}" width="${g.width}" height="${g.height}" role="img" aria-labelledby="diagram-title"><title id="diagram-title">Attack flow: ${count(g.rows.length, "step", "steps")} between ${count(g.lanes.length, "entity", "entities")}</title>
<defs><marker id="arrowhead" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"></path></marker></defs>${lanes}${arrows}
</svg>
</figure>`;
}
