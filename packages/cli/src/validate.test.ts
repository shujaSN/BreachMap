import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fake, hasControl, issuesOf, lines } from "./fake-io.ts";
import { run } from "./main.ts";

const fixtures = new URL("../../../fixtures/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, fixtures), "utf8");
const VALID = read("valid.json");
const INVALID = readdirSync(new URL("invalid/", fixtures)).filter((f) => f.endsWith(".json"));

// Returns the valid fixture as JSON text after a change.
function edit(change: (d: ReturnType<typeof JSON.parse>) => void): string {
  const data = JSON.parse(VALID);
  change(data);
  return JSON.stringify(data);
}

const MISMATCH = edit((d) => {
  d.steps[0].confidence = "likely";
});
const TWO_ISSUES = edit((d) => {
  d.steps[0].confidence = "likely";
  d.sources[0].url = "http://example.com/a";
});

async function check(argv: string[], files: Record<string, string>) {
  const { io, out, err } = fake(files);
  const code = await run(["validate", ...argv], io);
  return { code, out, err };
}

describe("validate", () => {
  it("FR-13: a valid file prints ✓ and exits 0", async () => {
    expect(await check(["a.json"], { "a.json": VALID })).toEqual({
      code: 0,
      out: ["✓ a.json"],
      err: [],
    });
  });

  it("FR-13: several valid files print ✓ each, in order, and exit 0", async () => {
    expect(await check(["b.json", "a.json"], { "a.json": VALID, "b.json": VALID })).toEqual({
      code: 0,
      out: ["✓ b.json", "✓ a.json"],
      err: [],
    });
  });

  it("FR-5, FR-13: an invalid file prints the file, path, message and fix, and exits 1", async () => {
    expect(await check(["bad.json"], { "bad.json": MISMATCH })).toEqual({
      code: 1,
      out: [],
      err: [
        'bad.json: steps[0].confidence: "likely" is not an allowed value',
        '  fix: Use one of: "confirmed", "reported", "disputed".',
      ],
    });
  });

  it("FR-5: every issue of a file is printed, in the order validate() gives", async () => {
    const issues = issuesOf(TWO_ISSUES);
    expect(issues).toHaveLength(2);
    const { err } = await check(["bad.json"], { "bad.json": TWO_ISSUES });
    expect(err).toEqual(lines("bad.json", issues));
  });

  it.each<[string, string[]]>([
    ["invalid first", ["bad.json", "good.json"]],
    ["invalid last", ["good.json", "bad.json"]],
  ])(
    "FR-13: with one valid and one invalid file (%s), both are checked and exit is 1",
    async (_, argv) => {
      expect(await check(argv, { "good.json": VALID, "bad.json": MISMATCH })).toEqual({
        code: 1,
        out: ["✓ good.json"],
        err: lines("bad.json", issuesOf(MISMATCH)),
      });
    },
  );

  it("FR-5, FR-13: an unreadable file is reported and exits 1", async () => {
    expect(await check(["missing.json"], {})).toEqual({
      code: 1,
      out: [],
      err: ["missing.json: cannot read the file", "  fix: Check the path."],
    });
  });

  it("FR-13: an unreadable file does not stop the other files", async () => {
    expect(await check(["missing.json", "a.json"], { "a.json": VALID })).toEqual({
      code: 1,
      out: ["✓ a.json"],
      err: ["missing.json: cannot read the file", "  fix: Check the path."],
    });
  });

  it.each([
    ["an empty file", ""],
    ["a syntax error", "{ nope"],
    ["a trailing comma", '{"id": 1,}'],
    ["cut-off JSON", VALID.slice(0, 100)],
  ])("FR-5: %s is reported as bad JSON at (root) and exits 1", async (_, text) => {
    expect(await check(["x.json"], { "x.json": text })).toEqual({
      code: 1,
      out: [],
      err: ["x.json: (root): is not valid JSON", "  fix: Fix the JSON syntax."],
    });
  });

  it.each([
    ["an array", "[]"],
    ["a string", '"hi"'],
    ["null", "null"],
    ["a number", "1"],
    ["an empty object", "{}"],
  ])("FR-5: valid JSON that is %s gets the issues from validate() and exits 1", async (_, text) => {
    expect(await check(["x.json"], { "x.json": text })).toEqual({
      code: 1,
      out: [],
      err: lines("x.json", issuesOf(text)),
    });
  });

  it.each(INVALID)("AC1, FR-4: invalid/%s exits 1 with its exact issue lines", async (name) => {
    const text = read(`invalid/${name}`);
    const issues = issuesOf(text);
    const { code, out, err } = await check([name], { [name]: text });
    expect(issues).not.toEqual([]);
    expect(err[0]).toBe(`${name}: ${issues[0]?.path}: ${issues[0]?.message}`);
    expect({ code, out, err }).toEqual({ code: 1, out: [], err: lines(name, issues) });
  });

  it("AC1: all invalid fixtures together exit 1 and print nothing to out", async () => {
    const files = Object.fromEntries(INVALID.map((n) => [n, read(`invalid/${n}`)]));
    const { code, out, err } = await check(INVALID, files);
    expect({ code, out }).toEqual({ code: 1, out: [] });
    expect(err).toEqual(INVALID.flatMap((n) => lines(n, issuesOf(read(`invalid/${n}`)))));
  });

  it.each(["valid.json", "xss.json"])("AC1, AC3: %s exits 0", async (name) => {
    expect(await check([name], { [name]: read(name) })).toEqual({
      code: 0,
      out: [`✓ ${name}`],
      err: [],
    });
  });

  it("FR-5: an ESC sequence in a value never reaches the terminal", async () => {
    const text = edit((d) => {
      d.steps[0].confidence = "\u001b]0;pwned\u0007";
    });
    const { code, err } = await check(["bad.json"], { "bad.json": text });
    expect(code).toBe(1);
    expect(err.filter(hasControl)).toEqual([]);
  });

  it.each<[string, string, string]>([
    ["C1 CSI in a value", "\u009b31m", '"�31m" is not an allowed value'],
    ["DEL in a value", "a\u007fb", '"a�b" is not an allowed value'],
  ])("FR-5: control characters (%s) are replaced with U+FFFD", async (_, value, message) => {
    const text = edit((d) => {
      d.steps[0].confidence = value;
    });
    const { err } = await check(["bad.json"], { "bad.json": text });
    expect(err[0]).toBe(`bad.json: steps[0].confidence: ${message}`);
  });

  it.each<[string, string, string]>([
    ["ESC", "\u001b[31m.json", "�[31m.json"],
    ["a newline", "a\nb.json", "a�b.json"],
    ["a tab", "a\tb.json", "a�b.json"],
    ["NUL", "a\u0000b.json", "a�b.json"],
    ["C1 NEL", "a\u0085b.json", "a�b.json"],
  ])("FR-5: %s in an unreadable file name is replaced with U+FFFD", async (_, file, shown) => {
    const { err } = await check([file], {});
    expect(err).toEqual([`${shown}: cannot read the file`, "  fix: Check the path."]);
  });

  it("FR-13: control characters in a valid file name are replaced in the ✓ line", async () => {
    const file = "ok\u0007.json";
    expect((await check([file], { [file]: VALID })).out).toEqual(["✓ ok�.json"]);
  });
});

describe("validate encodings", () => {
  it("FR-13: a UTF-8 byte order mark is not a JSON error", async () => {
    const text = readFileSync(new URL("../../../fixtures/valid.json", import.meta.url), "utf8");
    const { io, out } = fake({ "a.json": `\uFEFF${text}` });
    expect(await run(["validate", "a.json"], io)).toBe(0);
    expect(out).toEqual(["✓ a.json"]);
  });
});
