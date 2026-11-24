import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkReferences, type Issue, validate } from "./index.ts";

const valid = JSON.parse(
  readFileSync(new URL("../../../fixtures/valid.json", import.meta.url), "utf8"),
);

// Returns a changed copy of the valid fixture.
function edit(change: (d: typeof valid) => void) {
  const data = structuredClone(valid);
  change(data);
  return data;
}

// Sets a value at a path like "steps[0].sourceIds[1]".
function setAt(data: typeof valid, path: string, value: unknown) {
  const keys = path.split(/[.[\]]+/).filter(Boolean);
  const last = keys.pop() as string;
  keys.reduce((o, k) => o[k], data)[last] = value;
}

const refsWith = (path: string, value: unknown) =>
  checkReferences(edit((d) => setAt(d, path, value)));

const withTypes = (types: string[]) =>
  edit((d) => {
    for (const [i, type] of types.entries()) d.sources[i].type = type;
  });

const ENTITY_IDS = '"example-group", "example-corp", "build-server"';
const STEP_IDS = '"phishing-email", "build-server-login", "tampered-release"';
const SOURCE_IDS = '"example-advisory", "example-vendor", "example-news"';

const dup = (path: string, id: string, first: string): Issue => ({
  path,
  message: `"${id}" is already used by ${first}`,
  fix: "Give it an id that is unique in this list.",
});

const repeat = (path: string, id: string): Issue => ({
  path,
  message: `"${id}" is already in this list`,
  fix: "Remove this repeat.",
});

const noEntity = (path: string, id = "ghost"): Issue => ({
  path,
  message: `"${id}" is not an entity id`,
  fix: `Use one of: ${ENTITY_IDS}, or add an entity with this id.`,
});

const noSource = (path: string): Issue => ({
  path,
  message: '"ghost" is not a source id',
  fix: `Use one of: ${SOURCE_IDS}, or add a source with this id.`,
});

const noStep = (path: string): Issue => ({
  path,
  message: '"ghost" is not a step id',
  fix: `Use one of: ${STEP_IDS}, or add a step with this id.`,
});

const uncited = (index: number, id: string): Issue => ({
  path: `sources[${index}]`,
  message: `"${id}" is never cited`,
  fix: "Cite it from a step, the impact or a defense, or remove it.",
});

const NO_PRIMARY: Issue = {
  path: "sources",
  message: "has no primary source",
  fix: "Add a source of type advisory, cve, vendor or report.",
};

const EXTRA = {
  id: "extra",
  url: "https://example.com/extra",
  title: "Extra research",
  publisher: "Example Lab",
  type: "research",
  retrievedAt: "2026-11-24",
};

// Breaks every reference rule, with problems spread over every list.
const broken = () =>
  edit((d) => {
    d.identifiers.cve.push("CVE-2099-0001");
    d.entities.push(structuredClone(valid.entities[0]));
    d.steps.push(structuredClone(valid.steps[0]));
    d.defenses.push(structuredClone(valid.defenses[1]));
    d.sources.push(structuredClone(valid.sources[1]));
    d.steps[0].to = "ghost";
    d.steps[0].sourceIds.push("example-advisory");
    Object.assign(d.steps[1], { from: "ghost", to: "phantom", sourceIds: ["ghost"] });
    d.impact.sourceIds = ["ghost"];
    Object.assign(d.defenses[0], { stepIds: ["ghost"], sourceIds: ["ghost"] });
    for (const source of d.sources) source.type = "news";
  });

describe("checkReferences", () => {
  it("FR-4: finds nothing wrong in the valid fixture", () => {
    expect(checkReferences(valid)).toEqual([]);
  });

  it.each([
    ["entities", "example-group"],
    ["steps", "phishing-email"],
    ["defenses", "phishing-resistant-mfa"],
    ["sources", "example-advisory"],
  ] as const)("FR-4: reports a duplicate id in %s", (list, id) => {
    const data = edit((d) => d[list].push(structuredClone(d[list][0])));
    const index = valid[list].length;
    expect(checkReferences(data)).toEqual([dup(`${list}[${index}].id`, id, `${list}[0]`)]);
  });

  it("FR-4: points every repeat of an id at its first use", () => {
    const data = edit((d) =>
      d.steps.push(structuredClone(d.steps[1]), structuredClone(d.steps[1])),
    );
    expect(checkReferences(data)).toEqual([
      dup("steps[3].id", "build-server-login", "steps[1]"),
      dup("steps[4].id", "build-server-login", "steps[1]"),
    ]);
  });

  it("FR-4: does not report a cited duplicate source as never cited", () => {
    const data = edit((d) => {
      d.sources[2].id = "example-vendor";
      d.steps[1].sourceIds = ["example-vendor"];
    });
    expect(checkReferences(data)).toEqual([dup("sources[2].id", "example-vendor", "sources[1]")]);
  });

  it("FR-4: allows the same id in different lists", () => {
    const data = edit((d) => {
      d.steps[2].id = "build-server";
      d.defenses[1].stepIds = ["build-server"];
    });
    expect(checkReferences(data)).toEqual([]);
  });

  it.each([
    ["steps[1].from", noEntity],
    ["steps[0].to", noEntity],
    ["steps[0].sourceIds[1]", noSource],
    ["impact.sourceIds[0]", noSource],
    ["defenses[1].sourceIds[0]", noSource],
    ["defenses[0].stepIds[1]", noStep],
  ])("FR-4: reports an unknown id at %s", (path, issue) => {
    expect(refsWith(path, "ghost")).toEqual([issue(path)]);
  });

  it.each([
    ["identifiers.cve", "CVE-2099-0001"],
    ["steps[0].sourceIds", "example-advisory"],
    ["impact.sourceIds", "example-vendor"],
    ["defenses[0].sourceIds", "example-advisory"],
    ["defenses[0].stepIds", "phishing-email"],
  ])("FR-4: reports a repeated id in %s", (path, id) => {
    expect(refsWith(path, [id, id])).toEqual([repeat(`${path}[1]`, id)]);
  });

  it("FR-4: reports a repeat that is not next to its first use", () => {
    const ids = ["example-advisory", "example-news", "example-advisory"];
    expect(refsWith("steps[0].sourceIds", ids)).toEqual([
      repeat("steps[0].sourceIds[2]", "example-advisory"),
    ]);
  });

  it("FR-4: reports every repeat after the first use", () => {
    const ids = ["example-advisory", "example-advisory", "example-advisory"];
    expect(refsWith("steps[0].sourceIds", ids)).toEqual([
      repeat("steps[0].sourceIds[1]", "example-advisory"),
      repeat("steps[0].sourceIds[2]", "example-advisory"),
    ]);
  });

  it("FR-4: reports an unknown id before its repeat", () => {
    expect(refsWith("steps[0].sourceIds", ["ghost", "ghost"])).toEqual([
      noSource("steps[0].sourceIds[0]"),
      noSource("steps[0].sourceIds[1]"),
      repeat("steps[0].sourceIds[1]", "ghost"),
    ]);
  });

  it("FR-4: allows an incident with no CVE list", () => {
    expect(checkReferences(edit((d) => delete d.identifiers))).toEqual([]);
  });

  it("FR-4: lists each known id once when a list has a duplicate", () => {
    const data = edit((d) => {
      d.entities.push(structuredClone(d.entities[0]));
      d.steps[1].from = "ghost";
    });
    expect(checkReferences(data)).toEqual([
      dup("entities[3].id", "example-group", "entities[0]"),
      noEntity("steps[1].from"),
    ]);
  });

  it("FR-4: allows a defense with no step ids", () => {
    expect(refsWith("defenses[0].stepIds", [])).toEqual([]);
  });

  it("FR-4: reports a source that is never cited", () => {
    expect(refsWith("steps[1].sourceIds[0]", "example-vendor")).toEqual([
      uncited(2, "example-news"),
    ]);
  });

  it("FR-4: reports an added source that nothing cites", () => {
    expect(checkReferences(edit((d) => d.sources.push(EXTRA)))).toEqual([uncited(3, "extra")]);
  });

  it.each(["steps[2].sourceIds[1]", "impact.sourceIds[1]", "defenses[1].sourceIds[1]"])(
    "FR-4: counts a cite from %s",
    (path) => {
      const data = edit((d) => {
        d.sources.push(EXTRA);
        setAt(d, path, "extra");
      });
      expect(checkReferences(data)).toEqual([]);
    },
  );

  it("FR-4: reports sources with no primary type", () => {
    expect(checkReferences(withTypes(["news", "research", "news"]))).toEqual([NO_PRIMARY]);
  });

  it.each(["advisory", "cve", "vendor", "report"])(
    "FR-4: accepts %s as the only primary source",
    (type) => {
      expect(checkReferences(withTypes(["news", "research", type]))).toEqual([]);
    },
  );

  it("FR-4: returns problems list by list, duplicates first", () => {
    expect(checkReferences(broken())).toEqual([
      repeat("identifiers.cve[1]", "CVE-2099-0001"),
      dup("entities[3].id", "example-group", "entities[0]"),
      dup("steps[3].id", "phishing-email", "steps[0]"),
      noEntity("steps[0].to"),
      repeat("steps[0].sourceIds[1]", "example-advisory"),
      noEntity("steps[1].from"),
      noEntity("steps[1].to", "phantom"),
      noSource("steps[1].sourceIds[0]"),
      noSource("impact.sourceIds[0]"),
      dup("defenses[2].id", "verify-builds", "defenses[1]"),
      noStep("defenses[0].stepIds[0]"),
      noSource("defenses[0].sourceIds[0]"),
      dup("sources[3].id", "example-vendor", "sources[1]"),
      uncited(2, "example-news"),
      NO_PRIMARY,
    ]);
  });
});

describe("validate", () => {
  it("FR-4: returns ok with the valid fixture", () => {
    expect(validate(valid)).toEqual({ ok: true, value: valid });
  });

  it("FR-4: returns reference problems as an error", () => {
    expect(validate(edit((d) => setAt(d, "steps[1].from", "ghost")))).toEqual({
      ok: false,
      error: [noEntity("steps[1].from")],
    });
  });

  it("FR-4, FR-5: skips reference rules when the schema fails", () => {
    const data = edit((d) => {
      d.title = 42;
      d.steps[1].from = "ghost";
    });
    expect(validate(data)).toEqual({
      ok: false,
      error: [
        { path: "title", message: "must be a string, not a number", fix: "Change it to a string." },
      ],
    });
  });

  const inputs = [
    ["valid", valid],
    ["reference-broken", broken()],
    ["schema-broken", edit((d) => setAt(d, "sources[0].url", "http://example.com"))],
  ];

  it.each(inputs)("FR-6: gives the same result twice for the %s input", (_, input) => {
    expect(validate(input)).toEqual(validate(input));
  });

  it.each(inputs)("FR-6: does not change the %s input", (_, input) => {
    const before = structuredClone(input);
    validate(input);
    expect(input).toEqual(before);
  });
});
