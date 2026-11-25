import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../packages/core/src/index.ts";

export type Grade = {
  steps: { stepId: string; supported: boolean; note?: string }[];
  covered: { goldenStepId: string; covered: boolean; note?: string }[];
};

export type Case = {
  id: string;
  output: unknown;
  golden: unknown;
  grade?: Grade;
  urls: Record<string, number | null>;
};

export const isOk = (status: number | null) => status !== null && status >= 200 && status < 300;

const ratio = (part: number, whole: number) => (whole ? part / whole : 0);

const reviewedBy = (incident: unknown) =>
  (incident as { provenance?: { reviewedBy?: string } } | null)?.provenance?.reviewedBy;

const stepIds = (incident: unknown) => {
  const steps = (incident as { steps?: unknown } | null)?.steps;
  return Array.isArray(steps) ? steps.map((s) => s?.id).filter((id) => typeof id === "string") : [];
};

const hits = (ids: string[], rows: { id: string; ok: boolean }[]) => {
  const ok = new Set(rows.filter((r) => r.ok).map((r) => r.id));
  return ids.filter((id) => ok.has(id)).length;
};

export function score(cases: Case[]) {
  const sum = (f: (c: Case) => number) => cases.reduce((n, c) => n + f(c), 0);
  const supported = (c: Case) =>
    hits(
      stepIds(c.output),
      (c.grade?.steps ?? []).map((r) => ({ id: r.stepId, ok: r.supported })),
    );
  const covered = (c: Case) =>
    hits(
      stepIds(c.golden),
      (c.grade?.covered ?? []).map((r) => ({ id: r.goldenStepId, ok: r.covered })),
    );
  const broken = cases.flatMap((c) =>
    Object.entries(c.urls).flatMap(([url, status]) => (isOk(status) ? [] : [url])),
  );
  const unverified = cases.filter((c) => !reviewedBy(c.golden)).map((c) => c.id);
  const E1 = ratio(cases.filter((c) => validate(c.output).ok).length, cases.length);
  const E3 = ratio(
    sum(supported),
    sum((c) => stepIds(c.output).length),
  );
  const E4 = ratio(
    sum(covered),
    sum((c) => stepIds(c.golden).length),
  );
  return {
    E1,
    E2: broken.length,
    E3,
    E4,
    pass: { E1: E1 === 1, E2: broken.length === 0, E3: E3 >= 0.9, E4: E4 >= 0.8 },
    broken,
    ungraded: cases.filter((c) => !c.grade).map((c) => c.id),
    unverified,
    provisional: unverified.length > 0,
  };
}

export const spotCheck = (cases: Case[]) =>
  cases
    .flatMap((c) => (c.grade?.steps ?? []).map((s) => ({ id: c.id, stepId: s.stepId })))
    .filter((_, i) => i % 5 === 0);

export async function statusOf(url: string): Promise<number | null> {
  for (const method of ["HEAD", "GET"]) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; breachmap-evals)" },
      });
      if (response.ok || method === "GET") return response.status;
    } catch {
      if (method === "GET") return null;
    }
  }
  return null;
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

async function main(runDir: string) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const ids = readdirSync(runDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();
  const cases: Case[] = [];
  for (const id of ids) {
    const text = readFileSync(join(runDir, `${id}.json`), "utf8");
    let output: unknown = text;
    try {
      output = JSON.parse(text);
    } catch {}
    const gradePath = join(runDir, "grades", `${id}.json`);
    const list = (output as { sources?: unknown } | null)?.sources;
    const sources = Array.isArray(list) ? list.filter((x) => typeof x?.url === "string") : [];
    const urls = Object.fromEntries(
      await Promise.all(sources.map(async (s) => [s.url, await statusOf(s.url)] as const)),
    );
    cases.push({
      id,
      output,
      golden: readJson(join(root, "evals", "golden", `${id}.json`)),
      grade: existsSync(gradePath) ? readJson(gradePath) : undefined,
      urls,
    });
  }
  const versions = cases.map(
    (c) =>
      (c.output as { provenance?: { skillVersion?: string } } | null)?.provenance?.skillVersion,
  );
  const skillVersion = versions.find((v) => typeof v === "string") ?? "unknown";
  const date = basename(runDir);
  const result = { date, skillVersion, ids, ...score(cases), spotCheck: spotCheck(cases) };
  mkdirSync(join(root, "evals", "results"), { recursive: true });
  const out = join(root, "evals", "results", `${date}-skill-${skillVersion}.json`);
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ...result, spotCheck: undefined }, null, 2));
  console.log(`Wrote ${out}`);
}

if (import.meta.main) {
  const runDir = process.argv[2];
  if (!runDir) {
    console.error("Usage: pnpm eval:score evals/runs/<date>");
    process.exitCode = 2;
  } else {
    await main(runDir);
  }
}
