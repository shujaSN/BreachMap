import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { validate } from "../packages/core/src/index.ts";
import { render } from "../packages/render/src/index.ts";
import { buildSite } from "./build-site.ts";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const FILES = readdirSync(join(REPO, "gallery/incidents"))
  .filter((f) => f.endsWith(".json"))
  .sort();
const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
const VALID = fixture("valid.json");
const HTTP_URL = fixture("invalid/http-url.json");
const ID: string = JSON.parse(VALID).id;
const rendered = (version: string) => {
  const result = render(JSON.parse(VALID), { version });
  if (!result.ok) throw new Error("fixtures/valid.json must render");
  return result.value;
};
const MAP = rendered("9.8.7");
const MAP_PATH = `gallery/maps/${ID}.html`;
const BAD_EVALS = "evals/results/2026-03-01-skill-0.1.0.json";
const evals = (date: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    date,
    skillVersion: "0.1.0",
    E1: 1,
    E2: 0,
    E3: 1,
    E4: 0.9,
    provisional: false,
    ...extra,
  });

let dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "breachmap-site-"));
  dirs.push(dir);
  return dir;
}

// Makes a temp repo root with a cli version, one valid incident and its map; null leaves a file out.
function fakeRoot(files: Record<string, string | null> = {}): string {
  const root = temp();
  const all = {
    "packages/cli/package.json": JSON.stringify({ version: "9.8.7" }),
    [`gallery/incidents/${ID}.json`]: VALID,
    [MAP_PATH]: MAP,
    ...files,
  };
  for (const [path, content] of Object.entries(all)) {
    if (content === null) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

// Makes a fake root whose map is a symlink to a file outside it holding content.
function linkedRoot(content: string): string {
  const target = join(temp(), "map.html");
  writeFileSync(target, content);
  const root = fakeRoot({ [MAP_PATH]: null });
  mkdirSync(join(root, "gallery/maps"));
  symlinkSync(target, join(root, MAP_PATH));
  return root;
}

const index = (out: string) => readFileSync(join(out, "index.html"), "utf8");
const written = (out: string) => (existsSync(out) ? readdirSync(out) : []);

describe("buildSite: the real gallery", () => {
  it("S002 FR-5: returns no errors and writes a card per incident", () => {
    const out = temp();
    expect(buildSite(REPO, out)).toEqual([]);
    expect(index(out).match(/<li\b[^>]*\bclass="case[" ]/g)).toHaveLength(FILES.length);
  });

  it("S002 FR-2, FR-5: copies every map byte for byte", () => {
    const out = temp();
    buildSite(REPO, out);
    const names = FILES.map((f) => f.replace(/\.json$/, ".html"));
    expect(readdirSync(join(out, "maps")).sort()).toEqual(names);
    for (const name of names) {
      expect(readFileSync(join(out, "maps", name)), name).toEqual(
        readFileSync(join(REPO, "gallery/maps", name)),
      );
    }
  });
});

describe("buildSite: inputs", () => {
  it("S002 FR-5: reads the version from packages/cli/package.json", () => {
    const out = temp();
    expect(buildSite(fakeRoot(), out)).toEqual([]);
    expect(index(out)).toContain("Breachmap 9.8.7");
  });

  it("S002 FR-3, FR-5: uses the latest eval result by file name", () => {
    const root = fakeRoot({
      "evals/results/2026-02-01-skill-0.2.0.json": evals("2026-02-01"),
      "evals/results/2026-01-01-skill-0.1.0.json": evals("2026-01-01"),
    });
    const out = temp();
    expect(buildSite(root, out)).toEqual([]);
    expect([index(out).includes("2026-02-01"), index(out).includes("2026-01-01")]).toEqual([
      true,
      false,
    ]);
  });

  it("S002 FR-3, FR-5: has no evals section without eval results", () => {
    const out = temp();
    buildSite(fakeRoot(), out);
    expect(index(out)).not.toContain('id="evals"');
  });

  it("S002 FR-2: writes the rendered map to out/maps", () => {
    const out = temp();
    buildSite(fakeRoot(), out);
    expect(readFileSync(join(out, "maps", `${ID}.html`), "utf8")).toBe(MAP);
  });

  it("S002 FR-2, NFR-1: a symlinked map with the same bytes builds into a plain file", () => {
    const out = temp();
    expect(buildSite(linkedRoot(MAP), out)).toEqual([]);
    expect(lstatSync(join(out, "maps", `${ID}.html`)).isFile()).toBe(true);
  });

  it("S002 FR-3: accepts eval scores at the bounds", () => {
    const root = fakeRoot({
      "evals/results/2026-03-01.json": evals("2026-03-01", { E1: 0, E2: 3, E3: 0, E4: 1 }),
    });
    expect(buildSite(root, temp())).toEqual([]);
  });

  it("S002 FR-5: deletes old files in out", () => {
    const out = temp();
    writeFileSync(join(out, "old.html"), "old");
    buildSite(fakeRoot(), out);
    expect(existsSync(join(out, "old.html"))).toBe(false);
  });

  it("S002 FR-5: an incident file that starts with a UTF-8 byte order mark builds", () => {
    const out = temp();
    expect(
      buildSite(fakeRoot({ [`gallery/incidents/${ID}.json`]: `\uFEFF${VALID}` }), out),
    ).toEqual([]);
    expect(index(out)).toContain(`href="maps/${ID}.html"`);
  });
});

describe("buildSite: errors", () => {
  it("S002 FR-5: a missing map is an error with its path, and no index is written", () => {
    const out = temp();
    const errors = buildSite(fakeRoot({ [MAP_PATH]: null }), out);
    expect(errors).toEqual([expect.stringContaining(MAP_PATH)]);
    expect(existsSync(join(out, "index.html"))).toBe(false);
  });

  it("S002 FR-5: an invalid incident is an error naming the file, and no index is written", () => {
    const out = temp();
    const errors = buildSite(fakeRoot({ "gallery/incidents/bad.json": HTTP_URL }), out);
    expect(errors).toContainEqual(expect.stringContaining("bad.json"));
    expect(existsSync(join(out, "index.html"))).toBe(false);
  });

  it.each([
    ["a hand-written map", () => fakeRoot({ [MAP_PATH]: "<!doctype html><p>map</p>\n" })],
    ["a map from another version", () => fakeRoot({ [MAP_PATH]: rendered("9.8.6") })],
    ["a map with one extra byte", () => fakeRoot({ [MAP_PATH]: `${MAP} ` })],
    ["a symlink to another file", () => linkedRoot("<p>other</p>")],
  ])("S002 NFR-1, FR-2: %s is one error naming the map, and nothing is written", (_, root) => {
    const out = temp();
    expect(buildSite(root(), out)).toEqual([expect.stringContaining(MAP_PATH)]);
    expect(written(out)).toEqual([]);
  });

  it("S002 FR-5: an id that differs from the file name is one error naming the file and id", () => {
    const out = temp();
    const root = fakeRoot({
      [`gallery/incidents/${ID}.json`]: null,
      "gallery/incidents/other.json": VALID,
    });
    const errors = buildSite(root, out);
    expect(errors).toEqual([expect.stringContaining("gallery/incidents/other.json")]);
    expect(errors[0]).toMatch(/\bid\b/);
    expect(existsSync(join(out, "index.html"))).toBe(false);
  });

  it.each([
    ["E1 is a string", evals("2026-03-01", { E1: "1" })],
    ["E4 is above 1", evals("2026-03-01", { E4: 1.5 })],
    ["E3 is below 0", evals("2026-03-01", { E3: -0.1 })],
    ["E2 is not an integer", evals("2026-03-01", { E2: 0.5 })],
    ["E2 is negative", evals("2026-03-01", { E2: -1 })],
    ["skillVersion is a number", evals("2026-03-01", { skillVersion: 1 })],
    ["provisional is missing", evals("2026-03-01", { provisional: undefined })],
    ["the file is not JSON", "{"],
  ])(
    "S002 FR-3: an eval result where %s is one error naming the file, and no index is written",
    (_, content) => {
      const out = temp();
      expect(buildSite(fakeRoot({ [BAD_EVALS]: content }), out)).toEqual([
        expect.stringContaining(BAD_EVALS),
      ]);
      expect(existsSync(join(out, "index.html"))).toBe(false);
    },
  );

  it.each([
    ["an incident file", "gallery/incidents/bad.json"],
    ["an eval result", BAD_EVALS],
  ])(
    "S002 FR-5: %s that is not JSON is one error with its path and not valid JSON, and no index is written",
    (_, path) => {
      const out = temp();
      const errors = buildSite(fakeRoot({ [path]: "{" }), out);
      expect(errors).toEqual([expect.stringContaining("not valid JSON")]);
      expect(errors[0]).toContain(path);
      expect(existsSync(join(out, "index.html"))).toBe(false);
    },
  );

  it.each([
    ["an invalid incident", () => fakeRoot({ "gallery/incidents/bad.json": HTTP_URL })],
    ["an incident that is not JSON", () => fakeRoot({ "gallery/incidents/bad.json": "{" })],
    [
      "an id that differs from the file name",
      () =>
        fakeRoot({ [`gallery/incidents/${ID}.json`]: null, "gallery/incidents/other.json": VALID }),
    ],
    ["a missing map", () => fakeRoot({ [MAP_PATH]: null })],
    ["a stale map", () => fakeRoot({ [MAP_PATH]: rendered("9.8.6") })],
    ["a bad eval result", () => fakeRoot({ [BAD_EVALS]: evals("2026-03-01", { E4: 1.5 }) })],
    ["an eval result that is not JSON", () => fakeRoot({ [BAD_EVALS]: "{" })],
  ])("S002 FR-5: every error line for %s has a fix hint", (_, root) => {
    const errors = buildSite(root(), temp());
    expect(errors).not.toEqual([]);
    expect(errors.filter((line) => !line.includes("fix:"))).toEqual([]);
  });

  it("S002 FR-5: an invalid incident's error lines carry each issue's fix", () => {
    const result = validate(JSON.parse(HTTP_URL));
    if (result.ok) throw new Error("fixtures/invalid/http-url.json must be invalid");
    expect(buildSite(fakeRoot({ "gallery/incidents/bad.json": HTTP_URL }), temp())).toEqual(
      result.error.map((issue) => expect.stringContaining(`fix: ${issue.fix}`)),
    );
  });
});
