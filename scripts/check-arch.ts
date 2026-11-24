import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { posix } from "node:path";

export type SourceFile = { path: string; content: string };

const LAYERS = ["schema", "core", "render", "cli"];
const NAMES: Record<string, string> = {
  "@breachmap/schema": "schema",
  "@breachmap/core": "core",
  "@breachmap/render": "render",
  breachmap: "cli",
};
const IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g;
const PACKAGE_NAME = /^(?:@[^/]+\/)?[^/]+/;
const IMPURE =
  /\bprocess\.|\brequire\s*\(|\bfetch\s*\(|\bnew\s+Date\b|\bDate\s*\(|\bDate\.now\b|\bMath\.random\b|\brandom(?:UUID|Bytes|Int)\b|\bgetRandomValues\b/;
const UNSAFE_HTML = /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\.write\b/;
const PURE_NOTE = "(schema, core and render must be pure)";

export function findViolations(files: SourceFile[]): string[] {
  const out: string[] = [];
  for (const { path, content } of files) {
    const pkg = path.split("/")[1] ?? "";
    const layer = LAYERS.indexOf(pkg);
    if (layer < 0) {
      out.push(`${path}: unknown package "${pkg}"`);
      continue;
    }
    const pure = pkg !== "cli";
    const test = path.endsWith(".test.ts");
    for (const [i, line] of content.split("\n").entries()) {
      const at = `${path}:${i + 1}:`;
      for (const [, spec = ""] of line.matchAll(IMPORT)) {
        const target = NAMES[spec.match(PACKAGE_NAME)?.[0] ?? ""];
        if (target && target !== pkg && LAYERS.indexOf(target) >= layer) {
          out.push(`${at} may not import "${spec}" (order: cli → render → core → schema)`);
        }
        if (
          spec.startsWith(".") &&
          !posix.join(posix.dirname(path), spec).startsWith(`packages/${pkg}/`)
        ) {
          out.push(`${at} relative import "${spec}" leaves the package`);
        }
        if (pure && !test && isBuiltin(spec) && !(pkg === "render" && spec === "node:crypto")) {
          out.push(`${at} may not import "${spec}" ${PURE_NOTE}`);
        }
      }
      const impure = pure && !test && line.match(IMPURE);
      if (impure) out.push(`${at} uses "${impure[0]}" ${PURE_NOTE}`);
      const unsafe = !test && line.match(UNSAFE_HTML);
      if (unsafe) out.push(`${at} uses "${unsafe[0]}" (never build DOM from HTML strings)`);
    }
  }
  return out;
}

function collect(): SourceFile[] {
  const files: SourceFile[] = [];
  for (const pkg of readdirSync("packages")) {
    const src = `packages/${pkg}/src`;
    if (!existsSync(src)) continue;
    for (const file of readdirSync(src, { recursive: true, encoding: "utf8" })) {
      const path = `${src}/${file}`;
      if (path.endsWith(".ts")) files.push({ path, content: readFileSync(path, "utf8") });
    }
  }
  return files;
}

if (import.meta.main) {
  const violations = findViolations(collect());
  for (const v of violations) console.error(v);
  console.log(
    violations.length ? `✗ ${violations.length} architecture violations` : "✓ architecture OK",
  );
  process.exitCode = violations.length ? 1 : 0;
}
