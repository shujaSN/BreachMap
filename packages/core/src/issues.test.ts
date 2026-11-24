import { readFileSync } from "node:fs";
import type { SchemaIssue } from "@breachmap/schema";
import { describe, expect, it } from "vitest";
import { checkSchema, formatPath, type Issue, toIssue } from "./index.ts";

const valid = JSON.parse(
  readFileSync(new URL("../../../fixtures/valid.json", import.meta.url), "utf8"),
);

// Checks a copy of the fixture with `value` at a dotted path; undefined removes the key.
function checkWith(path: string, value: unknown) {
  const data = structuredClone(valid);
  const parts = path.split(".");
  const key = parts.pop() as string;
  const parent = parts.reduce((o, k) => o[k], data);
  if (value === undefined) delete parent[key];
  else parent[key] = value;
  return checkSchema(data);
}

const fail = (path: string, message: string, fix: string) => ({
  ok: false,
  error: [{ path, message, fix }],
});

const PHASES = [
  "reconnaissance",
  "resource-development",
  "initial-access",
  "execution",
  "persistence",
  "privilege-escalation",
  "stealth",
  "defense-impairment",
  "credential-access",
  "discovery",
  "lateral-movement",
  "collection",
  "command-and-control",
  "exfiltration",
  "impact",
]
  .map((p) => `"${p}"`)
  .join(", ");

const NO_SOURCE = "Add the id of a source that backs this.";

describe("formatPath", () => {
  it.each<[PropertyKey[], string]>([
    [[], "(root)"],
    [["title"], "title"],
    [["dates", "started"], "dates.started"],
    [["steps", 3, "sourceIds", 0], "steps[3].sourceIds[0]"],
    [[0, "id"], "[0].id"],
  ])("FR-5: formats %j as %s", (path, expected) => {
    expect(formatPath(path)).toBe(expected);
  });
});

describe("checkSchema", () => {
  it("FR-1, FR-5: returns ok with the valid fixture", () => {
    expect(checkSchema(valid)).toEqual({ ok: true, value: valid });
  });

  it("FR-5: returns every problem in Zod's order", () => {
    const data = structuredClone(valid);
    data.title = 42;
    delete data.summary;
    data.sources[0].url = "http://example.com";
    expect(checkSchema(data)).toEqual({
      ok: false,
      error: [
        { path: "title", message: "must be a string, not a number", fix: "Change it to a string." },
        { path: "summary", message: "is missing", fix: 'Add "summary" (a string).' },
        {
          path: "sources[0].url",
          message: "must use https",
          fix: "Use the https:// address of the page.",
        },
      ],
    });
  });
});

describe("invalid_type", () => {
  it.each([
    ["title", "title", 'Add "title" (a string).'],
    ["dates", "dates", 'Add "dates" (an object).'],
    ["entities", "entities", 'Add "entities" (an array).'],
    ["dates.started", "dates.started", 'Add "started" (a string).'],
    ["steps.0.from", "steps[0].from", 'Add "from" (a string).'],
  ])("FR-5: reports the missing %s", (key, path, fix) => {
    expect(checkWith(key, undefined)).toEqual(fail(path, "is missing", fix));
  });

  it.each([
    ["title", 42, "title", "must be a string, not a number", "Change it to a string."],
    [
      "dates.started",
      2024,
      "dates.started",
      "must be a string, not a number",
      "Change it to a string.",
    ],
    [
      "dates.started",
      true,
      "dates.started",
      "must be a string, not a boolean",
      "Change it to a string.",
    ],
    [
      "steps.0.techniqueId",
      null,
      "steps[0].techniqueId",
      "must be a string, not null",
      "Change it to a string.",
    ],
    [
      "steps.0.sourceIds.0",
      1,
      "steps[0].sourceIds[0]",
      "must be a string, not a number",
      "Change it to a string.",
    ],
    ["entities", {}, "entities", "must be an array, not an object", "Change it to an array."],
    [
      "entities.0",
      "x",
      "entities[0]",
      "must be an object, not a string",
      "Change it to an object.",
    ],
    ["impact", [], "impact", "must be an object, not an array", "Change it to an object."],
  ])("FR-5: reports %s = %j as the wrong type", (key, value, path, message, fix) => {
    expect(checkWith(key, value)).toEqual(fail(path, message, fix));
  });

  it.each([
    [null, "must be an object, not null"],
    [[], "must be an object, not an array"],
    ["incident", "must be an object, not a string"],
    [42, "must be an object, not a number"],
    [true, "must be an object, not a boolean"],
    [undefined, "must be an object, not undefined"],
  ])("FR-5: reports the root value %j as the wrong type", (input, message) => {
    expect(checkSchema(input)).toEqual(fail("(root)", message, "Change it to an object."));
  });
});

describe("invalid_value", () => {
  it.each([
    [
      "steps.0.phase",
      "defense-evasion",
      "steps[0].phase",
      '"defense-evasion" is not an allowed value',
      `Use one of: ${PHASES}.`,
    ],
    ["schemaVersion", 2, "schemaVersion", "2 is not an allowed value", "Use 1."],
    ["schemaVersion", "1", "schemaVersion", '"1" is not an allowed value', "Use 1."],
    [
      "entities.0.kind",
      "bystander",
      "entities[0].kind",
      '"bystander" is not an allowed value',
      'Use one of: "attacker", "victim", "system".',
    ],
  ])("FR-5: reports %s = %j as not allowed", (key, value, path, message, fix) => {
    expect(checkWith(key, value)).toEqual(fail(path, message, fix));
  });

  it.each([
    ["schemaVersion", "schemaVersion", 'Add "schemaVersion" with 1.'],
    ["steps.0.phase", "steps[0].phase", `Add "phase" with one of: ${PHASES}.`],
    [
      "sources.1.type",
      "sources[1].type",
      'Add "type" with one of: "advisory", "cve", "vendor", "report", "research", "news".',
    ],
  ])("FR-5: reports the missing %s with its allowed values", (key, path, fix) => {
    expect(checkWith(key, undefined)).toEqual(fail(path, "is missing", fix));
  });
});

describe("too_small", () => {
  it.each([
    ["steps.1.sourceIds", "steps[1].sourceIds"],
    ["impact.sourceIds", "impact.sourceIds"],
    ["defenses.0.sourceIds", "defenses[0].sourceIds"],
  ])("FR-4, FR-5: reports an empty %s as having no source", (key, path) => {
    expect(checkWith(key, [])).toEqual(fail(path, "has no source", NO_SOURCE));
  });

  it.each([
    [
      "sources",
      [valid.sources[0]],
      "sources",
      "needs at least 2 items",
      'Give "sources" at least 2 items.',
    ],
    ["entities", [], "entities", "needs at least 1 item", 'Give "entities" at least 1 item.'],
    [
      "identifiers.cve",
      [],
      "identifiers.cve",
      "needs at least 1 item",
      'Give "cve" at least 1 item.',
    ],
  ])("FR-4, FR-5: reports %s with too few items", (key, value, path, message, fix) => {
    expect(checkWith(key, value)).toEqual(fail(path, message, fix));
  });

  it.each([
    [1, "needs at least 1 character", 'Give "title" at least 1 character.'],
    [3, "needs at least 3 characters", 'Give "title" at least 3 characters.'],
  ])("FR-5: reports a string under %i characters", (minimum, message, fix) => {
    const issue: SchemaIssue = {
      code: "too_small",
      origin: "string",
      minimum,
      inclusive: true,
      path: ["title"],
      input: "",
      message: "Too small",
    };
    expect(toIssue(issue)).toEqual({ path: "title", message, fix });
  });
});

describe("too_big", () => {
  it.each([
    [
      "title",
      121,
      "title",
      "is 121 characters long; the limit is 120",
      "Shorten it to 120 characters or fewer.",
    ],
    [
      "steps.0.id",
      65,
      "steps[0].id",
      "is 65 characters long; the limit is 64",
      "Shorten it to 64 characters or fewer.",
    ],
  ])("FR-5: reports %s at %i characters", (key, length, path, message, fix) => {
    expect(checkWith(key, "a".repeat(length))).toEqual(fail(path, message, fix));
  });

  it.each([
    [3, [1, 2, 3, 4], "is 4 items long; the limit is 3", "Shorten it to 3 items or fewer."],
    [1, [1, 2], "is 2 items long; the limit is 1", "Shorten it to 1 item or fewer."],
  ])("FR-5: reports an array over %i items", (maximum, input, message, fix) => {
    const issue: SchemaIssue = {
      code: "too_big",
      origin: "array",
      maximum,
      inclusive: true,
      path: ["entities"],
      input,
      message: "Too big",
    };
    expect(toIssue(issue)).toEqual({ path: "entities", message, fix });
  });
});

const circular = () => {
  const o: Record<string, unknown> = {};
  o.self = o;
  return o;
};

describe("never throws", () => {
  it.each<[unknown, string]>([
    [10n, "10 is not an allowed value"],
    [{ a: 1 }, "an object is not an allowed value"],
    [circular(), "an object is not an allowed value"],
  ])("FR-5: describes the odd value %s without throwing", (input, message) => {
    const issue: SchemaIssue = {
      code: "invalid_value",
      values: [1],
      path: ["x"],
      input,
      message: "",
    };
    expect(toIssue(issue)).toEqual({ path: "x", message, fix: "Use 1." });
  });

  it("FR-5: reports too_big without an input", () => {
    const issue: SchemaIssue = {
      code: "too_big",
      origin: "string",
      maximum: 5,
      path: ["x"],
      message: "",
    };
    expect(toIssue(issue)).toEqual({
      path: "x",
      message: "is too long; the limit is 5",
      fix: "Shorten it to 5 characters or fewer.",
    });
  });
});

describe("unrecognized_keys", () => {
  it("FR-5: reports one unknown key", () => {
    expect(checkWith("steps.0.sourceId", "x")).toEqual(
      fail("steps[0]", 'has unknown key "sourceId"', "Remove it or fix the spelling."),
    );
  });

  it("FR-5: reports two unknown keys at the root", () => {
    expect(checkSchema({ ...valid, a: 1, b: 2 })).toEqual(
      fail("(root)", 'has unknown keys "a", "b"', "Remove them or fix the spelling."),
    );
  });
});

describe("custom", () => {
  it.each([
    ["title", " ", "title", "must not be blank", "Write some text."],
    [
      "sources.0.url",
      "http://example.com",
      "sources[0].url",
      "must use https",
      "Use the https:// address of the page.",
    ],
    [
      "provenance.skillVersion",
      undefined,
      "provenance.skillVersion",
      "is required when createdBy is skill",
      "Add the version of the skill that made this file, e.g. 0.1.0.",
    ],
  ])("FR-4, FR-5: uses the rule's own fix for %s = %j", (key, value, path, message, fix) => {
    expect(checkWith(key, value)).toEqual(fail(path, message, fix));
  });

  it.each([undefined, {}])("FR-5: falls back to a generic fix when params is %j", (params) => {
    const issue: SchemaIssue = {
      code: "custom",
      params,
      path: ["id"],
      input: "x",
      message: "is taken",
    };
    expect(toIssue(issue)).toEqual({ path: "id", message: "is taken", fix: "Fix this value." });
  });
});

describe("other codes", () => {
  it.each<SchemaIssue>([
    { code: "invalid_union", errors: [], path: ["steps", 0], input: {}, message: "Invalid input" },
    {
      code: "invalid_format",
      format: "email",
      path: ["steps", 0],
      input: "x",
      message: "Invalid input",
    },
  ])("FR-5: keeps Zod's message for $code", (issue) => {
    const expected: Issue = { path: "steps[0]", message: "Invalid input", fix: "Fix this value." };
    expect(toIssue(issue)).toEqual(expected);
  });
});
