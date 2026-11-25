import { readFileSync } from "node:fs";
import { type Issue, validate } from "@breachmap/core";
import { render } from "@breachmap/render";
import { describe, expect, it } from "vitest";
import { fake, issuesOf, lines } from "./fake-io.ts";
import { type Io, run } from "./main.ts";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const read = (name: string) =>
  readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), "utf8");
const VALID = read("valid.json");
const BAD = read("invalid/http-url.json");

function html(text: string): string {
  const result = render(JSON.parse(text), { version });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

describe("render", () => {
  it.each([
    ["x.json", "x.html"],
    ["data/x.json", "data/x.html"],
    ["x.v2.json", "x.v2.html"],
    ["x", "x.html"],
  ])("FR-14: render %s writes %s by default", async (file, target) => {
    const { io, fs, out, err } = fake({ [file]: VALID });
    expect(await run(["render", file], io)).toBe(0);
    expect([...fs.keys()]).toEqual([file, target]);
    expect({ out, err }).toEqual({ out: [`Wrote ${target}`], err: [] });
  });

  it.each<[string, string[]]>([
    ["-o", ["render", "x.json", "-o", "out.html"]],
    ["--out", ["render", "x.json", "--out", "out.html"]],
    ["--out=", ["render", "x.json", "--out=out.html"]],
    ["-o before the file", ["render", "-o", "out.html", "x.json"]],
  ])("FR-14: %s sets the output path", async (_, argv) => {
    const { io, fs, out, err } = fake({ "x.json": VALID });
    expect(await run(argv, io)).toBe(0);
    expect([...fs.keys()]).toEqual(["x.json", "out.html"]);
    expect({ out, err }).toEqual({ out: ["Wrote out.html"], err: [] });
  });

  it.each(["valid.json", "xss.json"])(
    "FR-7, FR-14: the HTML for %s equals render() with the CLI version",
    async (name) => {
      const text = read(name);
      const { io, fs } = fake({ "x.json": text });
      expect(await run(["render", "x.json"], io)).toBe(0);
      expect(fs.get("x.html")).toBe(html(text));
    },
  );

  it.each<[string, string[]]>([
    ["the default path", ["render", "bad.json"]],
    ["-o", ["render", "bad.json", "-o", "out.html"]],
  ])(
    "FR-7, FR-14: invalid input prints the issues, writes nothing (%s), exits 1",
    async (_, argv) => {
      const { io, fs, out, err } = fake({ "bad.json": BAD });
      expect(await run(argv, io)).toBe(1);
      expect([...fs.keys()]).toEqual(["bad.json"]);
      expect({ out, err }).toEqual({ out: [], err: lines("bad.json", issuesOf(BAD)) });
    },
  );

  it("FR-14: an unreadable file is reported, nothing is written, exit 1", async () => {
    const { io, fs, out, err } = fake();
    expect(await run(["render", "missing.json"], io)).toBe(1);
    expect(fs.size).toBe(0);
    expect({ out, err }).toEqual({
      out: [],
      err: ["missing.json: cannot read the file", "  fix: Check the path."],
    });
  });

  it.each(["", "{ nope"])(
    "FR-14: bad JSON %j is reported, nothing is written, exit 1",
    async (text) => {
      const { io, fs, out, err } = fake({ "x.json": text });
      expect(await run(["render", "x.json"], io)).toBe(1);
      expect([...fs.keys()]).toEqual(["x.json"]);
      expect({ out, err }).toEqual({
        out: [],
        err: ["x.json: (root): is not valid JSON", "  fix: Fix the JSON syntax."],
      });
    },
  );

  it("FR-14: control characters in the printed output path are replaced with U+FFFD", async () => {
    const { io, fs, out } = fake({ "x.json": VALID });
    expect(await run(["render", "x.json", "-o", "o\u001b[2J.html"], io)).toBe(0);
    expect(fs.has("o\u001b[2J.html")).toBe(true);
    expect(out).toEqual(["Wrote o�[2J.html"]);
  });
});

describe("render write errors", () => {
  it("FR-14: a failed write prints an error and exits 1", async () => {
    const { io, err } = fake({
      "x.json": readFileSync(new URL("../../../fixtures/valid.json", import.meta.url), "utf8"),
    });
    io.writeFile = async () => Promise.reject(new Error("EACCES"));
    expect(await run(["render", "x.json"], io)).toBe(1);
    expect(err).toEqual([
      "x.html: cannot write the file",
      "  fix: Check that the folder exists and you can write to it.",
    ]);
  });
});
