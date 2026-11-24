import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type Incident,
  IncidentSchema,
  PRIMARY_SOURCE_TYPES,
  SOURCE_TYPES,
  TACTICS,
} from "./index.ts";

const valid = JSON.parse(
  readFileSync(new URL("../../../fixtures/valid.json", import.meta.url), "utf8"),
);

// Parses a copy of the fixture with `value` at a dotted path; undefined removes the key.
function issuesWith(path: string, value: unknown) {
  const data = structuredClone(valid);
  const parts = path.split(".");
  const key = parts.pop() as string;
  const parent = parts.reduce((o, k) => o[k], data);
  if (value === undefined) delete parent[key];
  else parent[key] = value;
  const result = IncidentSchema.safeParse(data);
  return result.success ? [] : result.error.issues;
}

const keys = (path: string) =>
  path
    .split(".")
    .filter(Boolean)
    .map((k) => (/^\d+$/.test(k) ? Number(k) : k));

const builtin = (code: string, path: string) => expect.objectContaining({ code, path: keys(path) });

const custom = (path: string, message: string) =>
  expect.objectContaining({
    code: "custom",
    path: keys(path),
    message,
    params: expect.objectContaining({ fix: expect.stringMatching(/\S/) }),
  });

const SLUG = "must be a lowercase slug like xz-backdoor-2024";
const BLANK = "must not be blank";
const DATE = "must be a real date like 2024-03-29, 2024-03 or 2024";
const FULL_DATE = "must be a real date like 2024-03-29";
const CVE = "must be a CVE ID like CVE-2024-3094";
const TECHNIQUE = "must be an ATT&CK technique ID like T1195 or T1195.002";
const VERSION = "must be a version like 0.1.0";

const IDS = ["id", "entities.0.id", "steps.0.id", "defenses.0.id", "sources.0.id"];
const TEXT = [
  "title",
  "summary",
  "entities.0.name",
  "steps.0.title",
  "steps.0.description",
  "impact.description",
  "defenses.0.action",
  "sources.0.title",
  "sources.0.publisher",
  "provenance.reviewedBy",
];
const LIMITS: [string, number][] = [
  ...IDS.map((path): [string, number] => [path, 64]),
  ["title", 120],
  ["summary", 500],
  ["entities.0.name", 80],
  ["steps.0.title", 120],
  ["steps.0.description", 600],
  ["impact.description", 600],
  ["defenses.0.action", 300],
  ["sources.0.title", 300],
  ["sources.0.publisher", 120],
  ["provenance.reviewedBy", 80],
];

describe("exports", () => {
  it("ADR 0002: TACTICS lists the 15 ATT&CK v20 Enterprise tactics in matrix order", () => {
    expect(Object.entries(TACTICS)).toEqual([
      ["reconnaissance", { id: "TA0043", name: "Reconnaissance" }],
      ["resource-development", { id: "TA0042", name: "Resource Development" }],
      ["initial-access", { id: "TA0001", name: "Initial Access" }],
      ["execution", { id: "TA0002", name: "Execution" }],
      ["persistence", { id: "TA0003", name: "Persistence" }],
      ["privilege-escalation", { id: "TA0004", name: "Privilege Escalation" }],
      ["stealth", { id: "TA0005", name: "Stealth" }],
      ["defense-impairment", { id: "TA0112", name: "Defense Impairment" }],
      ["credential-access", { id: "TA0006", name: "Credential Access" }],
      ["discovery", { id: "TA0007", name: "Discovery" }],
      ["lateral-movement", { id: "TA0008", name: "Lateral Movement" }],
      ["collection", { id: "TA0009", name: "Collection" }],
      ["command-and-control", { id: "TA0011", name: "Command and Control" }],
      ["exfiltration", { id: "TA0010", name: "Exfiltration" }],
      ["impact", { id: "TA0040", name: "Impact" }],
    ]);
  });

  it("FR-2: SOURCE_TYPES lists the six source types", () => {
    expect(SOURCE_TYPES).toEqual(["advisory", "cve", "vendor", "report", "research", "news"]);
  });

  it("FR-4: PRIMARY_SOURCE_TYPES lists the primary source types", () => {
    expect(PRIMARY_SOURCE_TYPES).toEqual(["advisory", "cve", "vendor", "report"]);
  });

  it("FR-2: Incident is the type IncidentSchema parses to", () => {
    expectTypeOf(IncidentSchema.parse).returns.toEqualTypeOf<Incident>();
  });

  it("ADR 0002: a step phase is typed as a TACTICS slug", () => {
    expectTypeOf<Incident["steps"][number]["phase"]>().toEqualTypeOf<keyof typeof TACTICS>();
  });
});

describe("valid input", () => {
  it("FR-1: accepts the valid fixture and returns it unchanged", () => {
    expect(IncidentSchema.safeParse(valid)).toEqual({ success: true, data: valid });
  });

  it.each(["identifiers", "steps.0.techniqueId", "provenance.reviewedBy"])(
    "FR-2: accepts the incident without the optional %s",
    (path) => {
      expect(issuesWith(path, undefined)).toEqual([]);
    },
  );

  it("FR-2: accepts null for every unknown date", () => {
    const dates = { started: null, discovered: null, disclosed: null };
    expect(issuesWith("dates", dates)).toEqual([]);
  });

  it("FR-2: accepts a defense with no stepIds", () => {
    expect(issuesWith("defenses.0.stepIds", [])).toEqual([]);
  });

  it("FR-4: accepts exactly 2 sources", () => {
    expect(issuesWith("sources", valid.sources.slice(0, 2))).toEqual([]);
  });

  it.each([
    ["entities.0.kind", "attacker"],
    ["entities.0.kind", "victim"],
    ["entities.0.kind", "system"],
    ["steps.0.confidence", "confirmed"],
    ["steps.0.confidence", "reported"],
    ["steps.0.confidence", "disputed"],
    ["provenance.createdBy", "human"],
    ...["advisory", "cve", "vendor", "report", "research", "news"].map((t) => [
      "sources.0.type",
      t,
    ]),
  ])("FR-2: accepts %s = %j", (path, value) => {
    expect(issuesWith(path, value)).toEqual([]);
  });

  it.each(Object.keys(TACTICS))("ADR 0002: accepts the phase %s", (phase) => {
    expect(issuesWith("steps.0.phase", phase)).toEqual([]);
  });

  it.each([
    ["title", "<script>alert(1)</script>"],
    ["summary", "**Bold**, _italic_ and [a link](https://example.com)"],
    ["steps.0.description", '<img src=x onerror="alert(1)">'],
    ["defenses.0.action", "```\necho hello\n```"],
  ])("FR-3: accepts markup in %s as plain text", (path, value) => {
    expect(issuesWith(path, value)).toEqual([]);
  });
});

describe("shape", () => {
  it.each([null, "incident", [], 42])("FR-1: rejects the root value %j", (input) => {
    expect(IncidentSchema.safeParse(input).error?.issues).toEqual([builtin("invalid_type", "")]);
  });

  it.each([
    ["title", undefined],
    ["title", 42],
    ["summary", undefined],
    ["dates", undefined],
    ["dates.started", 2024],
    ["dates.disclosed", undefined],
    ["entities", {}],
    ["entities.0", "example-corp"],
    ["entities.0.name", undefined],
    ["steps", undefined],
    ["steps.0.from", undefined],
    ["steps.0.to", 1],
    ["steps.0.techniqueId", null],
    ["steps.0.sourceIds", "example-advisory"],
    ["steps.0.sourceIds.0", 1],
    ["impact", "Lots of data"],
    ["impact.description", undefined],
    ["defenses.0.stepIds", null],
    ["sources", undefined],
    ["sources.0.url", undefined],
    ["sources.0.retrievedAt", null],
    ["identifiers.cve", "CVE-2024-3094"],
    ["provenance", undefined],
    ["provenance.createdAt", undefined],
    ["provenance.reviewedBy", null],
  ])("FR-2: rejects %s = %j as invalid_type", (path, value) => {
    expect(issuesWith(path, value)).toEqual([builtin("invalid_type", path)]);
  });

  it.each([
    ["schemaVersion", 2],
    ["schemaVersion", "1"],
    ["schemaVersion", undefined],
    ["entities.0.kind", "bystander"],
    ["steps.0.phase", "defense-evasion"],
    ["steps.0.phase", "Initial Access"],
    ["steps.0.phase", "TA0001"],
    ["steps.0.phase", undefined],
    ["steps.0.confidence", "likely"],
    ["sources.0.type", "blog"],
    ["provenance.createdBy", "bot"],
  ])("FR-1, FR-2: rejects %s = %j as invalid_value", (path, value) => {
    expect(issuesWith(path, value)).toEqual([builtin("invalid_value", path)]);
  });

  it.each([
    ["sourceId", ""],
    ["dates.sourceId", "dates"],
    ["identifiers.sourceId", "identifiers"],
    ["entities.0.sourceId", "entities.0"],
    ["steps.0.sourceId", "steps.0"],
    ["impact.sourceId", "impact"],
    ["defenses.0.sourceId", "defenses.0"],
    ["sources.0.sourceId", "sources.0"],
    ["provenance.sourceId", "provenance"],
  ])("FR-2: rejects the unknown key %s", (path, object) => {
    expect(issuesWith(path, "x")).toEqual([builtin("unrecognized_keys", object)]);
  });

  it.each([
    ["entities", []],
    ["steps", []],
    ["defenses", []],
    ["sources", [valid.sources[0]]],
    ["identifiers.cve", []],
    ["steps.0.sourceIds", []],
    ["impact.sourceIds", []],
    ["defenses.0.sourceIds", []],
  ])("FR-2, FR-4: rejects %s with too few items", (path, value) => {
    expect(issuesWith(path, value)).toEqual([builtin("too_small", path)]);
  });

  it.each(LIMITS)("FR-2: accepts %s at %i characters", (path, max) => {
    expect(issuesWith(path, "a".repeat(max))).toEqual([]);
  });

  it.each(LIMITS)("FR-2: rejects %s over %i characters", (path, max) => {
    expect(issuesWith(path, "a".repeat(max + 1))).toEqual([builtin("too_big", path)]);
  });

  it("FR-5: reports every issue, not only the first", () => {
    const result = IncidentSchema.safeParse({ ...valid, title: " ", summary: " " });
    expect(result.error?.issues.map((i) => i.path)).toEqual([["title"], ["summary"]]);
  });
});

describe("text and IDs", () => {
  it.each(TEXT)("FR-2: rejects blank text in %s", (path) => {
    expect(issuesWith(path, "   ")).toEqual([custom(path, BLANK)]);
  });

  it.each(["", "\t\n "])("FR-2: rejects the title %j as blank", (title) => {
    expect(issuesWith("title", title)).toEqual([custom("title", BLANK)]);
  });

  it.each(IDS)("FR-2: requires a slug for %s", (path) => {
    expect(issuesWith(path, "Example_ID")).toEqual([custom(path, SLUG)]);
  });

  it.each(["a", "2024", "xz-backdoor-2024"])("FR-2: accepts the slug %j", (id) => {
    expect(issuesWith("id", id)).toEqual([]);
  });

  it.each(["", "XZ-backdoor", "xz--backdoor", "-xz", "xz-", "xz backdoor", "xz_backdoor", "xz.1"])(
    "FR-2: rejects the slug %j",
    (id) => {
      expect(issuesWith("id", id)).toEqual([custom("id", SLUG)]);
    },
  );
});

describe("dates", () => {
  it.each(["2024", "2024-03", "2024-03-29", "2024-02-29", "2000-02-29"])(
    "FR-2: accepts the incident date %j",
    (date) => {
      expect(issuesWith("dates.started", date)).toEqual([]);
    },
  );

  it.each([
    "2024-02-30",
    "2023-02-29",
    "1900-02-29",
    "2024-04-31",
    "2024-13",
    "2024-00",
    "2024-03-00",
    "2024-3-29",
    "24",
    "2024/03/29",
    "2024-03-29T10:00:00Z",
    "",
  ])("FR-2: rejects the incident date %j", (date) => {
    expect(issuesWith("dates.started", date)).toEqual([custom("dates.started", DATE)]);
  });

  it.each(["dates.started", "dates.discovered", "dates.disclosed"])(
    "FR-2: checks the date in %s",
    (path) => {
      expect(issuesWith(path, "2024-02-30")).toEqual([custom(path, DATE)]);
    },
  );

  it.each(["sources.0.retrievedAt", "provenance.createdAt"])(
    "FR-2: accepts a leap day in %s",
    (path) => {
      expect(issuesWith(path, "2024-02-29")).toEqual([]);
    },
  );

  it.each([
    ["sources.0.retrievedAt", "2024-03"],
    ["sources.0.retrievedAt", "2024"],
    ["sources.0.retrievedAt", "2024-02-30"],
    ["sources.0.retrievedAt", "2024-03-29T10:00:00Z"],
    ["provenance.createdAt", "2024-03"],
    ["provenance.createdAt", "2023-02-29"],
    ["provenance.createdAt", ""],
  ])("FR-2: requires a full date in %s, not %j", (path, date) => {
    expect(issuesWith(path, date)).toEqual([custom(path, FULL_DATE)]);
  });
});

describe("formats", () => {
  it.each(["CVE-2024-3094", "CVE-2021-44228", "CVE-2024-1234567"])(
    "FR-2: accepts the CVE ID %s",
    (cve) => {
      expect(issuesWith("identifiers.cve.0", cve)).toEqual([]);
    },
  );

  it.each(["CVE-2024-309", "cve-2024-3094", "CVE-24-3094", "CVE-2024-30a4", "CVE-2024-3094 ", ""])(
    "FR-2: rejects the CVE ID %j",
    (cve) => {
      expect(issuesWith("identifiers.cve.0", cve)).toEqual([custom("identifiers.cve.0", CVE)]);
    },
  );

  it("FR-2: points a bad CVE ID at its own index", () => {
    expect(issuesWith("identifiers.cve.1", "CVE-1")).toEqual([custom("identifiers.cve.1", CVE)]);
  });

  it.each(["T1195", "T1195.002", "T9999"])("ADR 0002: accepts the technique ID %s", (id) => {
    expect(issuesWith("steps.0.techniqueId", id)).toEqual([]);
  });

  it.each(["T119", "T11950", "T1195.2", "T1195.0021", "t1195", "TA0001", "1195", ""])(
    "ADR 0002: rejects the technique ID %j",
    (id) => {
      expect(issuesWith("steps.0.techniqueId", id)).toEqual([
        custom("steps.0.techniqueId", TECHNIQUE),
      ]);
    },
  );

  it.each(["https://example.com", "https://example.com/a/b?c=d#e"])(
    "FR-4: accepts the https URL %s",
    (url) => {
      expect(issuesWith("sources.0.url", url)).toEqual([]);
    },
  );

  it.each([
    "not a url",
    "example.com/page",
    "https://",
    " https://example.com",
    "https://exa\tmple.com",
  ])("FR-4: rejects the unparseable URL %j once", (url) => {
    expect(issuesWith("sources.0.url", url)).toEqual([
      custom("sources.0.url", "must be a valid URL"),
    ]);
  });

  it.each(["http://example.com", "ftp://example.com/file", "javascript:alert(1)"])(
    "FR-4: rejects the non-https URL %s",
    (url) => {
      expect(issuesWith("sources.0.url", url)).toEqual([custom("sources.0.url", "must use https")]);
    },
  );
});

describe("provenance", () => {
  it.each(["0.1.0", "10.20.30"])("FR-2: accepts the skillVersion %s", (version) => {
    expect(issuesWith("provenance.skillVersion", version)).toEqual([]);
  });

  it.each(["0.1", "v0.1.0", "0.1.0-beta", "0.1.0.1", ""])(
    "FR-2: rejects the skillVersion %j",
    (version) => {
      expect(issuesWith("provenance.skillVersion", version)).toEqual([
        custom("provenance.skillVersion", VERSION),
      ]);
    },
  );

  it("FR-2: requires skillVersion when createdBy is skill", () => {
    expect(issuesWith("provenance.skillVersion", undefined)).toEqual([
      custom("provenance.skillVersion", "is required when createdBy is skill"),
    ]);
  });

  it("FR-2: allows a human-made incident without skillVersion", () => {
    const provenance = { createdBy: "human", createdAt: "2026-11-24" };
    expect(issuesWith("provenance", provenance)).toEqual([]);
  });
});
