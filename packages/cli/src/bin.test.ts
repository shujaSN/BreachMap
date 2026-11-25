import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const bin = fileURLToPath(new URL("./bin.ts", import.meta.url));
const fixture = (name: string) =>
  fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const { version } = pkg;
const cliDir = fileURLToPath(new URL("..", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "breachmap-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const runFile = (file: string, args: string[]) =>
  spawnSync(process.execPath, [file, ...args], { cwd: dir, encoding: "utf8" });

describe("bin.ts from source", () => {
  it("FR-16: prints the version", () => {
    expect(runFile(bin, ["--version"])).toMatchObject({ status: 0, stdout: `${version}\n` });
  });

  it.each([
    ["valid.json", 0],
    ["invalid/http-url.json", 1],
  ])("FR-13: validate %s exits %i", (name, status) => {
    expect(runFile(bin, ["validate", fixture(name)]).status).toBe(status);
  });

  it("FR-14: render writes the map to the -o path", () => {
    const out = join(dir, "valid.html");
    expect(runFile(bin, ["render", fixture("valid.json"), "-o", out]).status).toBe(0);
    expect(readFileSync(out, "utf8")).toMatch(/^<!doctype html>/);
  });

  it("FR-15: new creates the file once and never overwrites it", () => {
    expect(runFile(bin, ["new", "spawned"]).status).toBe(0);
    const first = readFileSync(join(dir, "spawned.json"), "utf8");
    expect(runFile(bin, ["new", "spawned"])).toMatchObject({
      status: 1,
      stderr: expect.stringContaining("already exists"),
    });
    expect(readFileSync(join(dir, "spawned.json"), "utf8")).toBe(first);
  });

  it("FR-16: a usage error exits 2", () => {
    expect(runFile(bin, ["nope"]).status).toBe(2);
  });
});

describe("bundled cli.js (ADR 0001)", () => {
  it("the build script bundles everything into one file that runs on its own", () => {
    const outfile = join(dir, "cli.js");
    const script = pkg.scripts.build.replace("--outfile=dist/cli.js", `--outfile=${outfile}`);
    expect(script).toContain(outfile);
    const PATH = `${join(cliDir, "node_modules", ".bin")}${delimiter}${process.env.PATH}`;
    const built = spawnSync(script, {
      cwd: cliDir,
      shell: true,
      encoding: "utf8",
      env: { ...process.env, PATH },
    });
    expect(built.status).toBe(0);
    const code = readFileSync(outfile, "utf8");
    expect(code.startsWith("#!/usr/bin/env node")).toBe(true);
    expect(code).not.toMatch(/from\s*["']@breachmap\/|from\s*["']zod["']/);
    expect(runFile(outfile, ["--version"])).toMatchObject({ status: 0, stdout: `${version}\n` });
    expect(runFile(outfile, ["validate", fixture("valid.json")]).status).toBe(0);
  });
});
