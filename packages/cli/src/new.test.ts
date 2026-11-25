import { validate } from "@breachmap/core";
import type { Incident } from "@breachmap/schema";
import { describe, expect, it } from "vitest";
import { fake, TODAY } from "./fake-io.ts";
import { run } from "./main.ts";

const FILE = "my-incident.json";

async function create(id = "my-incident", files: Record<string, string> = {}) {
  const f = fake(files);
  return { code: await run(["new", id], f.io), ...f };
}

async function starterText(): Promise<string> {
  const { fs } = await create();
  return fs.get(FILE) ?? "";
}

const starter = async (): Promise<Incident> => JSON.parse(await starterText());

const texts = (d: Incident) => [
  d.title,
  d.summary,
  ...d.entities.map((e) => e.name),
  ...d.steps.flatMap((s) => [s.title, s.description]),
  d.impact.description,
  ...d.defenses.map((x) => x.action),
  ...d.sources.flatMap((s) => [s.title, s.publisher]),
];

describe("new", () => {
  it("FR-15: creates <id>.json, prints the next step and exits 0", async () => {
    const { code, fs, out, err } = await create();
    expect(code).toBe(0);
    expect([...fs.keys()]).toEqual([FILE]);
    expect({ out, err }).toEqual({
      out: [`Created ${FILE}. Fill in the TODOs, then run: breachmap validate ${FILE}`],
      err: [],
    });
  });

  it("FR-15: the file is 2-space JSON with a trailing newline", async () => {
    const text = await starterText();
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
  });

  it("FR-15: the starter passes validate()", async () => {
    const data = await starter();
    expect(validate(data)).toEqual({ ok: true, value: data });
  });

  it("FR-15: the starter id is the given id", async () => {
    expect((await starter()).id).toBe("my-incident");
  });

  it("FR-15: provenance says a human created it today", async () => {
    expect((await starter()).provenance).toMatchObject({ createdBy: "human", createdAt: TODAY });
  });

  it("FR-15: every source was retrieved today", async () => {
    const dates = (await starter()).sources.map((s) => s.retrievedAt);
    expect(new Set(dates)).toEqual(new Set([TODAY]));
  });

  it("FR-15: every source URL is a placeholder on https://example.com/", async () => {
    const urls = (await starter()).sources.map((s) => s.url);
    expect(urls.filter((u) => !u.startsWith("https://example.com/"))).toEqual([]);
  });

  it("FR-15: every text field is a TODO placeholder", async () => {
    expect(texts(await starter()).filter((t) => !t.startsWith("TODO"))).toEqual([]);
  });

  it("FR-15, FR-14: the starter renders right away", async () => {
    const { io, fs } = fake();
    expect(await run(["new", "my-incident"], io)).toBe(0);
    expect(await run(["render", FILE], io)).toBe(0);
    expect(fs.has("my-incident.html")).toBe(true);
  });

  it.each([
    ["a one-character id", "a"],
    ["a slug with digits", "xz-backdoor-2024"],
    ["a 64-character id", `${"a".repeat(63)}b`],
  ])("FR-15: %s creates a valid <id>.json", async (_, id) => {
    const { code, fs } = await create(id);
    const data = JSON.parse(fs.get(`${id}.json`) ?? "null");
    expect(code).toBe(0);
    expect(data.id).toBe(id);
    expect(validate(data).ok).toBe(true);
  });

  it("FR-15: an existing file is never overwritten, exit 1", async () => {
    const { code, fs, out, err } = await create("my-incident", { [FILE]: "keep" });
    expect(code).toBe(1);
    expect(fs.get(FILE)).toBe("keep");
    expect({ out, err }).toEqual({
      out: [],
      err: [`${FILE} already exists.`, "  fix: Pick another id or delete the file."],
    });
  });

  it.each([
    ["a space and capitals", "My Incident"],
    ["an underscore", "a_b"],
    ["a leading hyphen", "-x"],
    ["a trailing hyphen", "x-"],
    ["a double hyphen", "a--b"],
    ["capitals", "ABC"],
    ["an empty id", ""],
    ["a path", "../evil"],
    ["a slash", "a/b"],
    ["a non-ASCII letter", "café"],
    ["65 characters", "a".repeat(65)],
  ])("FR-15, FR-16: an id with %s is a usage error, exit 2, nothing created", async (_, id) => {
    const { code, fs, out, err } = await create(id);
    expect(code).toBe(2);
    expect(fs.size).toBe(0);
    expect(out).toEqual([]);
    expect(err[0]).toMatch(/^error: \S/);
    expect(err[1]).toBe("Usage: breachmap <command> [options]");
  });
});

describe("new write errors", () => {
  it("FR-15: a failed create prints an error and exits 1", async () => {
    const { io, err } = fake();
    io.createFile = async () => Promise.reject(new Error("EACCES"));
    expect(await run(["new", "my-incident"], io)).toBe(1);
    expect(err).toEqual([
      "my-incident.json: cannot write the file",
      "  fix: Check that you can write to this folder.",
    ]);
  });
});
