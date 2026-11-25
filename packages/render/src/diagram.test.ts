import { readFileSync } from "node:fs";
import { layout, validate } from "@breachmap/core";
import type { Incident } from "@breachmap/schema";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { diagram } from "./diagram.ts";
import { render } from "./index.ts";

type Step = Incident["steps"][number];

// Loads a fixture as a validated incident.
function load(name: string): Incident {
  const data = JSON.parse(
    readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), "utf8"),
  );
  const result = validate(data);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const valid = load("valid.json");
const xss = load("xss.json");

// Returns a changed copy of the valid fixture.
function edit(change: (d: Incident) => void): Incident {
  const data = structuredClone(valid);
  change(data);
  return data;
}

const win = new Window();
const parse = (out: string) => new win.DOMParser().parseFromString(out, "text/html");

type Doc = ReturnType<typeof parse>;
type El = NonNullable<ReturnType<Doc["querySelector"]>>;
type Root = Doc | El;

const text = (el: { textContent: string | null } | null) =>
  (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function one(root: Root, selector: string): El {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

const all = (root: Root, selector: string): El[] => [...root.querySelectorAll(selector)];
const texts = (root: Root, selector: string) => all(root, selector).map(text);
const pick = (el: El | null, names: string[]) =>
  el && Object.fromEntries(names.map((n) => [n, el.getAttribute(n)]));

const svgOf = (input: Incident = valid) => one(parse(diagram(input).html), "figure.diagram svg");

function pageOf(input: Incident) {
  const result = render(input, { version: "0.1.0" });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return parse(result.value);
}

const STEP_IDS = ["phishing-email", "build-server-login", "tampered-release"];
const CONFIDENCES: Step["confidence"][] = ["confirmed", "reported", "disputed"];

const reversed = edit((d) => {
  d.entities.reverse();
});
const unused = edit((d) => {
  d.entities.push({ id: "bystander", name: "Bystander", kind: "system" });
});
const backward = edit((d) => {
  Object.assign(d.steps[1] ?? {}, { from: "build-server", to: "example-group" });
});
const single = edit((d) => {
  d.entities = d.entities.slice(0, 1);
  d.steps = d.steps.slice(0, 1).map((s) => ({ ...s, to: s.from }));
});

const CASES: [string, Incident][] = [
  ["valid", valid],
  ["reversed entities", reversed],
  ["an unused entity", unused],
  ["a backward arrow", backward],
  ["one self-step", single],
];

const TITLES: [Step["confidence"], string][] = [
  ["confirmed", "Step 1: Phishing email to an engineer"],
  ["reported", "Step 1: Phishing email to an engineer (reported)"],
  ["disputed", "Step 1: Phishing email to an engineer (disputed)"],
];

const nameOf = (n: number) => "abcdefghijklmnopqrstuvwxyz0123456789".repeat(3).slice(0, n);
const CUT = "abcdefghijklmnopqrs…";

const LABELS: [string, string, string][] = [
  ["1", "a", "a"],
  ["19", nameOf(19), nameOf(19)],
  ["20", nameOf(20), nameOf(20)],
  ["21", nameOf(21), CUT],
  ["80", nameOf(80), CUT],
  ["20 with & and <", "Tom & Jerry <Corp> 1", "Tom & Jerry <Corp> 1"],
  ["21 with & and <", "Tom & Jerry <Corp> 12", "Tom & Jerry <Corp> …"],
  ["20 emoji", "😀".repeat(20), "😀".repeat(20)],
  ["21 emoji", "😀".repeat(21), `${"😀".repeat(19)}…`],
];

const SOURCES: [string, () => El][] = [
  ["diagram()", () => svgOf(xss)],
  ["render()", () => one(pageOf(xss), "figure.diagram svg")],
];

function tags(svg: El) {
  const count: Record<string, number> = {};
  for (const el of all(svg, "*")) count[el.localName] = (count[el.localName] ?? 0) + 1;
  return count;
}

describe("diagram: frame", () => {
  it("FR-8: the root is one figure.diagram", () => {
    const { body } = parse(diagram(valid).html);
    expect([...body.children].map((el) => el.matches("figure.diagram"))).toEqual([true]);
  });

  it("FR-8: the figure holds one svg", () => {
    expect(all(one(parse(diagram(valid).html), "figure.diagram"), "svg")).toHaveLength(1);
  });

  it.each(CASES)("FR-8, ADR 0003: svg size comes from layout (%s)", (_, input) => {
    const { width, height } = layout(input);
    expect(pick(svgOf(input), ["viewBox", "width", "height"])).toEqual({
      viewBox: `0 0 ${width} ${height}`,
      width: `${width}`,
      height: `${height}`,
    });
  });

  it("FR-8: the svg is an image labelled by its title", () => {
    expect(pick(svgOf(), ["role", "aria-labelledby"])).toEqual({
      role: "img",
      "aria-labelledby": "diagram-title",
    });
  });

  it("FR-8: the first child of the svg is title#diagram-title", () => {
    const first = svgOf().firstElementChild;
    expect([first?.localName, first?.id]).toEqual(["title", "diagram-title"]);
  });

  it.each([
    ["valid", valid, "Attack flow: 3 steps between 3 entities"],
    ["an unused entity", unused, "Attack flow: 3 steps between 4 entities"],
    ["one self-step", single, "Attack flow: 1 step between 1 entity"],
  ])("FR-8: the svg title counts steps and lanes (%s)", (_, input, title) => {
    expect(text(one(svgOf(input), "title#diagram-title"))).toBe(title);
  });

  it("NFR-6: arrows are not tab stops inside the role=img diagram", () => {
    expect(all(svgOf(), "a.arrow").map((a) => a.getAttribute("tabindex"))).toEqual([
      "-1",
      "-1",
      "-1",
    ]);
  });

  it("FR-8: defs holds exactly one marker#arrowhead", () => {
    const markers = all(svgOf(), "marker").map((m) => [m.id, m.parentElement?.localName]);
    expect(markers).toEqual([["arrowhead", "defs"]]);
  });
});

describe("diagram: lanes", () => {
  it.each(CASES)(
    "ADR 0003: one g.lane per lane, in lane order, titled with the full name (%s)",
    (_, input) => {
      const name = new Map(input.entities.map((e) => [e.id, e.name]));
      expect(all(svgOf(input), "g.lane").map((g) => text(g.querySelector("title")))).toEqual(
        layout(input).lanes.map((l) => name.get(l.entityId)),
      );
    },
  );

  it.each(CASES)("ADR 0003: lane labels sit at the lane x, 28 above top (%s)", (_, input) => {
    const { lanes, top } = layout(input);
    expect(
      all(svgOf(input), "g.lane").map((g) => pick(g.querySelector("text.lane-label"), ["x", "y"])),
    ).toEqual(lanes.map((l) => ({ x: `${l.x}`, y: `${top - 28}` })));
  });

  it("FR-8: lane labels show the entity names, cut after 20 characters", () => {
    expect(texts(svgOf(), "g.lane text.lane-label")).toEqual([
      "Example Threat Group",
      "Example Corp",
      "Example Corp build …",
    ]);
  });

  it.each(LABELS)("FR-8: lane label of a name of length %s", (_, name, label) => {
    const input = edit((d) => Object.assign(d.entities[0] ?? {}, { name }));
    expect(text(one(svgOf(input), "g.lane text.lane-label"))).toBe(label);
  });

  it.each(LABELS)("FR-8: lane title keeps the full name of length %s", (_, name) => {
    const input = edit((d) => Object.assign(d.entities[0] ?? {}, { name }));
    expect(text(one(svgOf(input), "g.lane title"))).toBe(name);
  });

  it.each(CASES)("ADR 0003: lifelines run from top to bottom at the lane x (%s)", (_, input) => {
    const { lanes, top, bottom } = layout(input);
    expect(
      all(svgOf(input), "g.lane").map((g) =>
        pick(g.querySelector("line.lifeline"), ["x1", "x2", "y1", "y2"]),
      ),
    ).toEqual(lanes.map((l) => ({ x1: `${l.x}`, x2: `${l.x}`, y1: `${top}`, y2: `${bottom}` })));
  });
});

describe("diagram: arrows", () => {
  const arrows = (input: Incident = valid) => all(svgOf(input), "a.arrow");
  const confidences = (a: El) => CONFIDENCES.filter((c) => a.classList.contains(c));
  const first = (confidence: Step["confidence"]) =>
    one(svgOf(edit((d) => Object.assign(d.steps[0] ?? {}, { confidence }))), "a.arrow");

  it("FR-8: one a.arrow per step, in step order, linked to its step", () => {
    expect(arrows().map((a) => pick(a, ["href", "data-step"]))).toEqual(
      STEP_IDS.map((id) => ({ href: `#step-${id}`, "data-step": `step-${id}` })),
    );
  });

  it("FR-10: each arrow has its step's confidence class", () => {
    expect(arrows().map(confidences)).toEqual([["confirmed"], ["reported"], ["confirmed"]]);
  });

  it.each(CONFIDENCES)("FR-10: a %s step has only that confidence class", (confidence) => {
    expect(confidences(first(confidence))).toEqual([confidence]);
  });

  it("FR-8, FR-10: arrow titles are Step n, the step title and the confidence", () => {
    expect(arrows().map((a) => text(a.querySelector("title")))).toEqual([
      "Step 1: Phishing email to an engineer",
      "Step 2: Login to the build server (reported)",
      "Step 3: Backdoor added to the build script",
    ]);
  });

  it.each(TITLES)("FR-10: a %s step has the arrow title %s", (confidence, title) => {
    expect(text(one(first(confidence), "title"))).toBe(title);
  });

  it.each(CASES)(
    "ADR 0003: only a step between two lanes has a line, from x1 to x2 at row y (%s)",
    (_, input) => {
      const attrs = ["x1", "x2", "y1", "y2", "marker-end"];
      expect(arrows(input).map((a) => pick(a.querySelector("line"), attrs))).toEqual(
        layout(input).rows.map((r) =>
          r.x1 === r.x2
            ? null
            : {
                x1: `${r.x1}`,
                x2: `${r.x2}`,
                y1: `${r.y}`,
                y2: `${r.y}`,
                "marker-end": "url(#arrowhead)",
              },
        ),
      );
    },
  );

  it.each(CASES)(
    "ADR 0003: only a self-step has a dot, r 6 at its lane x and row y (%s)",
    (_, input) => {
      expect(arrows(input).map((a) => pick(a.querySelector("circle"), ["cx", "cy", "r"]))).toEqual(
        layout(input).rows.map((r) =>
          r.x1 === r.x2 ? { cx: `${r.x1}`, cy: `${r.y}`, r: "6" } : null,
        ),
      );
    },
  );

  it.each(CASES)(
    "FR-8: step numbers sit 8 above the row, centred on the arrow or 14 right of the dot (%s)",
    (_, input) => {
      const label = (a: El) => {
        const t = a.querySelector("text.step-n");
        return t && { ...pick(t, ["x", "y"]), n: text(t) };
      };
      expect(arrows(input).map(label)).toEqual(
        layout(input).rows.map((r) => ({
          x: `${r.x1 === r.x2 ? r.x1 + 14 : (r.x1 + r.x2) / 2}`,
          y: `${r.y - 8}`,
          n: `${r.n}`,
        })),
      );
    },
  );

  it.each(CASES)("ADR 0003: every number in the svg is an integer (%s)", (_, input) => {
    const svg = svgOf(input);
    const values = [svg, ...all(svg, "*")].flatMap((el) =>
      el.getAttributeNames().map((n) => `${n}="${el.getAttribute(n)}"`),
    );
    expect(values.filter((v) => /\.\d/.test(v))).toEqual([]);
  });
});

describe("diagram: in the page", () => {
  it("FR-8, ADR 0003: section#flow has the h2, then the diagram, then the step list", () => {
    const flow = one(pageOf(valid), "section#flow");
    const order = all(flow, "h2, figure.diagram, ol.steps").map((el) => el.localName);
    expect(order).toEqual(["h2", "figure", "ol"]);
  });

  it("FR-8, ADR 0003: every arrow links to a li.step on the page", () => {
    const doc = pageOf(valid);
    const targets = all(doc, "a.arrow").map(
      (a) =>
        doc.getElementById((a.getAttribute("href") ?? "").slice(1))?.matches("li.step") ?? false,
    );
    expect(targets).toEqual(valid.steps.map(() => true));
  });
});

describe("diagram: xss.json", () => {
  it.each(SOURCES)("NFR-1: the svg has only the expected elements (%s)", (_, svgFn) => {
    // 3 lanes and 3 steps, the last one a self-step.
    expect(tags(svgFn())).toEqual({
      title: 7,
      defs: 1,
      marker: 1,
      path: 1,
      g: 3,
      text: 6,
      line: 5,
      a: 3,
      circle: 1,
    });
  });

  it.each(SOURCES)("NFR-1: entity names and step titles show as plain text (%s)", (_, svgFn) => {
    const svg = svgFn();
    expect([texts(svg, "g.lane > title"), texts(svg, "a.arrow > title")]).toEqual([
      ["</title><script>alert(1)</script>", "Example Corp", "Example Corp build server"],
      [
        'Step 1: "><svg onload=alert(1)>',
        "Step 2: Login to the build server (reported)",
        "Step 3: Backdoor added to the build script",
      ],
    ]);
  });

  it.each(SOURCES)(
    "NFR-1: lane labels cut the raw name and show it as plain text (%s)",
    (_, svgFn) => {
      expect(texts(svgFn(), "g.lane text.lane-label")).toEqual([
        "</title><script>ale…",
        "Example Corp",
        "Example Corp build …",
      ]);
    },
  );

  it.each(SOURCES)("NFR-1: no svg element has an on* attribute (%s)", (_, svgFn) => {
    const svg = svgFn();
    const names = [svg, ...all(svg, "*")].flatMap((el) => el.getAttributeNames());
    expect(names.filter((n) => n.startsWith("on"))).toEqual([]);
  });
});
