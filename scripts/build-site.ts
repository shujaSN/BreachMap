import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Issue, validate } from "../packages/core/src/index.ts";
import { type Evals, renderGallery } from "../packages/render/src/gallery.ts";
import { render } from "../packages/render/src/index.ts";

const json = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return undefined;
  }
};

const jsonFiles = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];

const score = (n: unknown) => typeof n === "number" && n >= 0 && n <= 1;

const isEvals = (value: unknown): value is Evals => {
  const e = value as Record<keyof Evals, unknown> | undefined;
  return (
    typeof e?.date === "string" &&
    typeof e.skillVersion === "string" &&
    typeof e.provisional === "boolean" &&
    [e.E1, e.E3, e.E4].every(score) &&
    Number.isInteger(e.E2) &&
    Number(e.E2) >= 0
  );
};

export function buildSite(root: string, out: string): string[] {
  const { version } = json(join(root, "packages/cli/package.json")) as { version: string };
  const errors: string[] = [];
  const line = (path: string, message: string, fix: string) => `${path}: ${message} (fix: ${fix})`;
  const fail = (...lines: string[]) => {
    errors.push(...lines);
    return [];
  };
  const issues = (path: string, list: Issue[]) =>
    list.map((i) => line(path, `${i.path} ${i.message}`, i.fix));
  const built = jsonFiles(join(root, "gallery/incidents")).flatMap((file) => {
    const path = `gallery/incidents/${file}`;
    const data = json(join(root, path));
    if (data === undefined) return fail(line(path, "not valid JSON", "Fix the JSON syntax."));
    const result = validate(data);
    if (!result.ok) return fail(...issues(path, result.error));
    const { id } = result.value;
    if (file !== `${id}.json`) {
      return fail(line(path, `id "${id}" must match the file name`, `Rename it to ${id}.json.`));
    }
    const page = render(result.value, { version });
    if (!page.ok) return fail(...issues(path, page.error));
    const map = `gallery/maps/${id}.html`;
    const committed = existsSync(join(root, map)) && readFileSync(join(root, map), "utf8");
    if (committed !== page.value) {
      return fail(
        line(map, "is missing or out of date", `pnpm breachmap render ${path} -o ${map}`),
      );
    }
    return [{ incident: result.value, html: page.value }];
  });
  const latest = jsonFiles(join(root, "evals/results")).at(-1);
  const data = latest ? json(join(root, "evals/results", latest)) : undefined;
  const evals = isEvals(data) ? data : undefined;
  if (latest && !evals) {
    const problem = data === undefined ? "not valid JSON" : "not a valid eval result";
    errors.push(line(`evals/results/${latest}`, problem, "Run pnpm eval:score again."));
  }
  if (errors.length > 0) return errors;
  const incidents = built.map((b) => b.incident);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "maps"), { recursive: true });
  writeFileSync(join(out, "index.html"), renderGallery(incidents, { version, evals }));
  for (const { incident, html } of built)
    writeFileSync(join(out, "maps", `${incident.id}.html`), html);
  return [];
}

if (import.meta.main) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const errors = buildSite(root, join(root, "site"));
  for (const line of errors) console.error(line);
  if (errors.length > 0) process.exitCode = 1;
  else console.log("Built site/index.html and site/maps/");
}
