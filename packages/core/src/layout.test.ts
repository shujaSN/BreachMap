import { readFileSync } from "node:fs";
import type { Incident } from "@breachmap/schema";
import { describe, expect, it } from "vitest";
import { type Lane, type Layout, layout, type Row } from "./index.ts";

const valid: Incident = JSON.parse(
  readFileSync(new URL("../../../fixtures/valid.json", import.meta.url), "utf8"),
);

// Returns a changed copy of the valid fixture.
function edit(change: (d: Incident) => void): Incident {
  const data = structuredClone(valid);
  change(data);
  return data;
}

// Sets from and to of each step, in step order.
const withMoves = (moves: [string, string][]) =>
  edit((d) => {
    for (const [i, [from, to]] of moves.entries()) Object.assign(d.steps[i] ?? {}, { from, to });
  });

const lane = (entityId: string, x: number): Lane => ({ entityId, x });
const row = (stepId: string, n: number, y: number, x1: number, x2: number): Row => ({
  stepId,
  n,
  y,
  x1,
  x2,
});

const entity = (id: string) => ({ id, name: `Entity ${id}`, kind: "system" as const });
const laneIds = (result: Layout) => result.lanes.map((l) => l.entityId);

const VALID: Layout = {
  width: 528,
  height: 256,
  laneWidth: 160,
  top: 64,
  bottom: 232,
  lanes: [lane("example-group", 104), lane("example-corp", 264), lane("build-server", 424)],
  rows: [
    row("phishing-email", 1, 92, 104, 264),
    row("build-server-login", 2, 148, 104, 424),
    row("tampered-release", 3, 204, 424, 424),
  ],
};

const unused = edit((d) => d.entities.push(entity("bystander")));
const single = edit((d) => {
  d.entities = d.entities.slice(0, 1);
  d.steps = d.steps.slice(0, 1).map((s) => ({ ...s, to: s.from }));
});

describe("layout", () => {
  it("FR-8, ADR 0003: lays out the valid fixture", () => {
    expect(layout(valid)).toEqual(VALID);
  });

  it.each([
    ["reversed", ["build-server", "example-corp", "example-group"]],
    ["rotated", ["example-corp", "build-server", "example-group"]],
  ])("FR-8, ADR 0003: ignores the entities list order when it is %s", (_, order) => {
    const data = edit((d) => d.entities.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)));
    expect(layout(data)).toEqual(VALID);
  });

  it.each([
    [
      "from before to in one step",
      [
        ["example-corp", "example-group"],
        ["example-group", "build-server"],
        ["build-server", "build-server"],
      ],
      ["example-corp", "example-group", "build-server"],
    ],
    [
      "a to before a later from",
      [
        ["example-group", "build-server"],
        ["example-corp", "example-group"],
        ["build-server", "build-server"],
      ],
      ["example-group", "build-server", "example-corp"],
    ],
    [
      "a first use in a late step",
      [
        ["build-server", "build-server"],
        ["build-server", "build-server"],
        ["example-corp", "example-group"],
      ],
      ["build-server", "example-corp", "example-group"],
    ],
  ] as [string, [string, string][], string[]][])(
    "FR-8, ADR 0003: orders lanes by first appearance: %s",
    (_, moves, expected) => {
      expect(laneIds(layout(withMoves(moves)))).toEqual(expected);
    },
  );

  it("FR-8, ADR 0003: puts arrows on the lanes of their from and to", () => {
    const data = withMoves([
      ["example-group", "build-server"],
      ["example-corp", "example-group"],
      ["build-server", "build-server"],
    ]);
    expect(layout(data).rows).toEqual([
      row("phishing-email", 1, 92, 104, 264),
      row("build-server-login", 2, 148, 424, 104),
      row("tampered-release", 3, 204, 264, 264),
    ]);
  });

  it("FR-8, ADR 0003: puts an unused entity in the last lane and in no row", () => {
    expect(layout(unused)).toEqual({
      ...VALID,
      width: 688,
      lanes: [...VALID.lanes, lane("bystander", 584)],
    });
  });

  it("FR-8, ADR 0003: keeps unused entities in their list order", () => {
    const data = edit((d) => {
      d.entities = [entity("first-unused"), ...d.entities, entity("last-unused")];
    });
    expect(laneIds(layout(data))).toEqual([
      "example-group",
      "example-corp",
      "build-server",
      "first-unused",
      "last-unused",
    ]);
  });

  it("FR-8, ADR 0003: gives a step from an entity to itself equal x1 and x2", () => {
    const data = withMoves([
      ["example-group", "example-corp"],
      ["example-corp", "example-corp"],
      ["build-server", "example-group"],
    ]);
    expect(layout(data).rows[1]).toEqual(row("build-server-login", 2, 148, 264, 264));
  });

  it("FR-8, ADR 0003: lays out one entity and one step", () => {
    expect(layout(single)).toEqual({
      width: 208,
      height: 144,
      laneWidth: 160,
      top: 64,
      bottom: 120,
      lanes: [lane("example-group", 104)],
      rows: [row("phishing-email", 1, 92, 104, 104)],
    });
  });

  it.each([
    ["valid", valid],
    ["unused-entity", unused],
    ["single", single],
  ])("FR-8, ADR 0003: uses only integers for the %s input", (_, input) => {
    const r = layout(input);
    const numbers = [
      r.width,
      r.height,
      r.laneWidth,
      r.top,
      r.bottom,
      ...r.lanes.map((l) => l.x),
      ...r.rows.flatMap((w) => [w.n, w.y, w.x1, w.x2]),
    ];
    expect(numbers.filter((n) => !Number.isInteger(n))).toEqual([]);
  });

  it("FR-8, ADR 0003: gives the same layout twice for the same input", () => {
    expect(layout(unused)).toEqual(layout(unused));
  });

  it("FR-8, ADR 0003: does not change the input", () => {
    const before = structuredClone(unused);
    layout(unused);
    expect(unused).toEqual(before);
  });
});
