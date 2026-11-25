import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Case, isOk, score, spotCheck, statusOf } from "./score.ts";

const valid = JSON.parse(readFileSync(new URL("../fixtures/valid.json", import.meta.url), "utf8"));
const invalid = JSON.parse(
  readFileSync(new URL("../fixtures/invalid/http-url.json", import.meta.url), "utf8"),
);
const IDS: string[] = valid.steps.map((s: { id: string }) => s.id);

const supported = (ids: string[], ok = true) => ids.map((stepId) => ({ stepId, supported: ok }));
const covered = (ids: string[], ok = true) =>
  ids.map((goldenStepId) => ({ goldenStepId, covered: ok }));
const withSteps = (n: number) => ({
  steps: Array.from({ length: n }, (_, i) => ({ id: `s${i}` })),
});
const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);

const make = (over: Partial<Case> = {}): Case => ({
  id: "a",
  output: valid,
  golden: valid,
  grade: { steps: supported(IDS), covered: covered(IDS) },
  urls: { "https://example.com/a": 200 },
  ...over,
});

describe("score", () => {
  it("E1-E4: a clean run passes every target", () => {
    expect(score([make(), make({ id: "b" })])).toMatchObject({
      E1: 1,
      E2: 0,
      E3: 1,
      E4: 1,
      broken: [],
      pass: { E1: true, E2: true, E3: true, E4: true },
      ungraded: [],
    });
  });

  it("E1: counts outputs that fail validation, including text that is not JSON", () => {
    expect(
      score([make(), make({ output: invalid }), make({ output: "{ not json" })]),
    ).toMatchObject({
      E1: 1 / 3,
      pass: { E1: false },
    });
  });

  it("E2: lists every source URL that does not resolve", () => {
    const urls = {
      "https://example.com/a": 200,
      "https://example.com/b": 404,
      "https://example.com/c": null,
    };
    expect(score([make({ urls })])).toMatchObject({
      E2: 2,
      broken: ["https://example.com/b", "https://example.com/c"],
      pass: { E2: false },
    });
  });

  it("E3: needs at least 90% of output steps supported", () => {
    const at = (n: number) =>
      make({ output: withSteps(10), grade: { steps: supported(ids(n)), covered: covered(IDS) } });
    expect(score([at(9)]).pass.E3).toBe(true);
    expect(score([at(8)])).toMatchObject({ E3: 0.8, pass: { E3: false } });
  });

  it("E3: a step with no grade row counts as unsupported", () => {
    const grade = { steps: supported(IDS.slice(0, 1)), covered: covered(IDS) };
    expect(score([make({ grade })]).E3).toBe(1 / 3);
  });

  it("E3: grade rows for steps that are not in the output do not count", () => {
    const grade = { steps: supported(["ghost", ...IDS.slice(0, 1)]), covered: covered(IDS) };
    expect(score([make({ grade })]).E3).toBe(1 / 3);
  });

  it("E4: needs at least 80% of golden steps covered", () => {
    const at = (n: number) =>
      make({ golden: withSteps(5), grade: { steps: supported(IDS), covered: covered(ids(n)) } });
    expect(score([at(4)]).pass.E4).toBe(true);
    expect(score([at(3)])).toMatchObject({ E4: 0.6, pass: { E4: false } });
  });

  it("E3, E4: an ungraded case counts against both, next to a graded one", () => {
    expect(score([make(), make({ id: "b", grade: undefined })])).toMatchObject({
      E3: 0.5,
      E4: 0.5,
      pass: { E3: false, E4: false },
      ungraded: ["b"],
    });
  });

  it("section 10: results are provisional until every golden file is human-reviewed", () => {
    const { reviewedBy: _, ...unreviewed } = valid.provenance;
    expect(score([make({ golden: { ...valid, provenance: unreviewed } })])).toMatchObject({
      provisional: true,
      unverified: ["a"],
    });
    expect(score([make()])).toMatchObject({ provisional: false, unverified: [] });
  });
});

describe("spotCheck", () => {
  it("section 10: picks a fixed 20% of graded steps for a human to check", () => {
    const cases = [make({ grade: { steps: supported(ids(10)), covered: [] } })];
    expect(spotCheck(cases)).toEqual([
      { id: "a", stepId: "s0" },
      { id: "a", stepId: "s5" },
    ]);
  });
});

describe("isOk and statusOf", () => {
  it.each([
    [200, true],
    [299, true],
    [301, false],
    [404, false],
    [null, false],
  ])("E2: status %s is ok: %s", (status, ok) => {
    expect(isOk(status)).toBe(ok);
  });

  const server = createServer((req, res) => {
    if (req.url === "/moved") res.writeHead(301, { location: "/ok" }).end();
    else if (req.url === "/no-head" && req.method === "HEAD") res.writeHead(405).end();
    else if (req.url === "/missing") res.writeHead(404).end();
    else res.writeHead(200).end("ok");
  });
  let base = "";
  beforeAll(async () => {
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((done) => server.close(() => done())));

  it.each([
    ["/ok", 200],
    ["/moved", 200],
    ["/no-head", 200],
    ["/missing", 404],
  ])("E2: %s resolves to status %i (HEAD, then GET, following redirects)", async (path, status) => {
    expect(await statusOf(`${base}${path}`)).toBe(status);
  });

  it("E2: an unreachable host gives null", async () => {
    expect(await statusOf("http://127.0.0.1:9/")).toBeNull();
  });
});
