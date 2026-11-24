import { readdirSync, readFileSync } from "node:fs";
import type { Incident } from "@breachmap/schema";
import { describe, expect, it } from "vitest";
import { checkReferences, checkSchema, type Issue, validate } from "./index.ts";

const root = new URL("../../../fixtures/", import.meta.url);
const load = (name: string) => JSON.parse(readFileSync(new URL(name, root), "utf8"));

const INVALID: [string, string, Issue][] = [
  [
    "schema-mismatch.json",
    "a field does not match the schema",
    {
      path: "steps[0].confidence",
      message: '"likely" is not an allowed value',
      fix: 'Use one of: "confirmed", "reported", "disputed".',
    },
  ],
  [
    "missing-source.json",
    "a step, the impact, or a defense has no source",
    {
      path: "steps[0].sourceIds",
      message: "has no source",
      fix: "Add the id of a source that backs this.",
    },
  ],
  [
    "unknown-reference.json",
    "a reference points to an ID that does not exist",
    {
      path: "steps[1].from",
      message: '"ghost-group" is not an entity id',
      fix: 'Use one of: "example-group", "example-corp", "build-server", or add an entity with this id.',
    },
  ],
  [
    "duplicate-id.json",
    "an ID is used twice within the same list",
    {
      path: "entities[3].id",
      message: '"example-group" is already used by entities[0]',
      fix: "Give it an id that is unique in this list.",
    },
  ],
  [
    "uncited-source.json",
    "a source is never referenced",
    {
      path: "sources[3]",
      message: '"example-extra" is never cited',
      fix: "Cite it from a step, the impact or a defense, or remove it.",
    },
  ],
  [
    "too-few-sources.json",
    "the incident has fewer than 2 sources",
    { path: "sources", message: "needs at least 2 items", fix: 'Give "sources" at least 2 items.' },
  ],
  [
    "no-primary-source.json",
    "the incident has no primary source",
    {
      path: "sources",
      message: "has no primary source",
      fix: "Add a source of type advisory, cve, vendor or report.",
    },
  ],
  [
    "http-url.json",
    "a URL does not use https",
    {
      path: "sources[0].url",
      message: "must use https",
      fix: "Use the https:// address of the page.",
    },
  ],
];

describe("fixtures", () => {
  it("AC1: valid.json passes", () => {
    expect(validate(load("valid.json")).ok).toBe(true);
  });

  it("AC3, FR-3: xss.json is valid, because markup in text is plain text", () => {
    const xss = load("xss.json");
    expect(validate(xss)).toEqual({ ok: true, value: xss });
  });

  it.each(INVALID)(
    "AC1, FR-4: invalid/%s fails because %s, and breaks no other rule",
    (file, _rule, issue) => {
      const data = load(`invalid/${file}`);
      const schema = checkSchema(data);
      const every = [...(schema.ok ? [] : schema.error), ...checkReferences(data as Incident)];
      expect(validate(data)).toEqual({ ok: false, error: [issue] });
      expect(every).toEqual([issue]);
    },
  );

  it("AC1: every file in fixtures/invalid has an expected issue", () => {
    const files = readdirSync(new URL("invalid/", root))
      .filter((f) => f.endsWith(".json"))
      .sort();
    expect(files).toEqual(INVALID.map(([file]) => file).sort());
  });
});
