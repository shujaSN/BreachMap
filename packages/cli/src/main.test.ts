import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fake, hasControl } from "./fake-io.ts";
import { run } from "./main.ts";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const HELP = [
  "Usage: breachmap <command> [options]",
  "",
  "Commands:",
  "  validate <file...>        Check incident files. Exit 1 if any is invalid.",
  "  render <file> [-o <out>]  Validate, then write one offline HTML map.",
  "  new <id>                  Create a starter incident file <id>.json.",
  "",
  "Options:",
  "  -h, --help                Show this help.",
  "  -v, --version             Show the version.",
];

describe("run", () => {
  it.each(["--help", "-h"])("FR-16: %s prints the help and exits 0", async (flag) => {
    const { io, out, err } = fake();
    expect(await run([flag], io)).toBe(0);
    expect({ out, err }).toEqual({ out: HELP, err: [] });
  });

  it.each(["--version", "-v"])("FR-16: %s prints the version and exits 0", async (flag) => {
    const { io, out, err } = fake();
    expect(await run([flag], io)).toBe(0);
    expect({ out, err }).toEqual({ out: [version], err: [] });
  });

  it.each<[string, string[]]>([
    ["no arguments", []],
    ["an unknown command", ["frobnicate"]],
    ["an unknown option", ["--nope"]],
    ["an unknown option after a command", ["validate", "a.json", "--nope"]],
    ["validate with no file", ["validate"]],
    ["render with no file", ["render"]],
    ["render with 2 files", ["render", "a.json", "b.json"]],
    ["render with -o and no value", ["render", "a.json", "-o"]],
    ["new with no id", ["new"]],
    ["new with 2 ids", ["new", "a", "b"]],
  ])("FR-16: %s is a usage error: exit 2, an error line, then the help", async (_, argv) => {
    const { io, fs, out, err } = fake({ "a.json": "{}", "b.json": "{}" });
    expect(await run(argv, io)).toBe(2);
    expect(err[0]).toMatch(/^error: \S/);
    expect(err.slice(1)).toEqual(HELP);
    expect(out).toEqual([]);
    expect([...fs.keys()]).toEqual(["a.json", "b.json"]);
  });

  it.each<[string, string[]]>([
    ["an unknown command", ["\u001b[2Jx"]],
    ["an unknown option", ["--\u001b[31m"]],
    ["a bad id", ["new", "\u009b31m"]],
  ])("FR-16: control characters in %s are not printed", async (_, argv) => {
    const { io, err } = fake();
    expect(await run(argv, io)).toBe(2);
    expect(err.filter(hasControl)).toEqual([]);
  });
});

describe("usage edge cases", () => {
  it("FR-16: -o with a command other than render is a usage error", async () => {
    const { io, err } = fake({ "a.json": "{}" });
    expect(await run(["validate", "a.json", "-o", "x.html"], io)).toBe(2);
    expect(err[0]).toBe("error: -o only works with render");
  });

  it("FR-16: a multi-line parser error prints each line cleanly", async () => {
    const { io, err } = fake();
    expect(await run(["render", "a.json", "-o", "-v"], io)).toBe(2);
    expect(err.filter((line) => line.includes("\uFFFD"))).toEqual([]);
  });
});
