import { describe, expect, it } from "vitest";
import { findViolations } from "./check-arch.ts";

const check = (path: string, content: string) => findViolations([{ path, content }]);

describe("layers", () => {
  it("allows imports of lower layers", () => {
    expect(check("packages/core/src/a.ts", 'import { x } from "@breachmap/schema";')).toEqual([]);
    expect(check("packages/cli/src/a.ts", 'import { r } from "@breachmap/render";')).toEqual([]);
  });

  it("flags imports of the same or a higher layer, with file and line", () => {
    expect(check("packages/core/src/a.ts", '\nimport { r } from "@breachmap/render";')).toEqual([
      'packages/core/src/a.ts:2: may not import "@breachmap/render" (order: cli → render → core → schema)',
    ]);
    expect(check("packages/schema/src/a.ts", 'export * from "@breachmap/core/x";')).toHaveLength(1);
    expect(check("packages/render/src/a.ts", 'const m = await import("breachmap");')).toHaveLength(
      1,
    );
  });

  it("flags relative imports that leave the package", () => {
    expect(check("packages/core/src/a.ts", 'import "../../render/src/b.ts";')).toEqual([
      'packages/core/src/a.ts:1: relative import "../../render/src/b.ts" leaves the package',
    ]);
    expect(check("packages/core/src/x/a.ts", 'import { b } from "../b.ts";')).toEqual([]);
  });

  it("flags files outside known packages", () => {
    expect(check("packages/web/src/a.ts", "")).toEqual([
      'packages/web/src/a.ts: unknown package "web"',
    ]);
  });
});

describe("purity", () => {
  it("flags Node built-ins in schema, core and render", () => {
    expect(check("packages/core/src/a.ts", 'import { readFileSync } from "node:fs";')).toHaveLength(
      1,
    );
    expect(check("packages/schema/src/a.ts", 'import path from "path";')).toHaveLength(1);
    expect(
      check("packages/core/src/a.ts", 'import { createHash } from "node:crypto";'),
    ).toHaveLength(1);
  });

  it("allows node:crypto in render and any built-in in cli", () => {
    expect(check("packages/render/src/a.ts", 'import { createHash } from "node:crypto";')).toEqual(
      [],
    );
    expect(check("packages/cli/src/a.ts", 'import { readFile } from "node:fs/promises";')).toEqual(
      [],
    );
  });

  it.each([
    "const t = Date.now();",
    "const d = new Date();",
    "const n = Math.random();",
    "const id = crypto.randomUUID();",
    "const e = process.env.HOME;",
    'const r = await fetch("https://example.com");',
    'const m = require("x");',
  ])("flags %s in pure packages", (line) => {
    expect(check("packages/render/src/a.ts", line)).toHaveLength(1);
  });

  it("allows pure date helpers, cli I/O and anything in tests", () => {
    expect(check("packages/core/src/a.ts", "const ms = Date.UTC(2024, 1, 30);")).toEqual([]);
    expect(check("packages/cli/src/a.ts", "const t = new Date(); process.exit(1);")).toEqual([]);
    expect(check("packages/core/src/a.test.ts", 'import fs from "node:fs"; Date.now();')).toEqual(
      [],
    );
  });
});

describe("unsafe HTML", () => {
  it.each([
    "el.innerHTML = s;",
    "el.outerHTML = s;",
    'el.insertAdjacentHTML("end", s);',
    "document.write(s);",
  ])("flags %s in any package", (line) => {
    expect(check("packages/cli/src/a.ts", line)).toHaveLength(1);
  });

  it("allows it in tests", () => {
    expect(check("packages/render/src/a.test.ts", "document.write(html);")).toEqual([]);
  });
});
