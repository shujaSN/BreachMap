import { isAbsolute, relative, resolve } from "node:path";
import { render } from "@breachmap/render";
import { clean, type Io, printIssues, readIncident, VERSION } from "./shared.ts";

export async function renderFile(io: Io, file: string, out?: string): Promise<number> {
  const input = await readIncident(io, file);
  if (!input.ok) return 1;
  const result = render(input.value, { version: VERSION });
  if (!result.ok) {
    printIssues(io, file, result.error);
    return 1;
  }
  const target = out ?? `${file.replace(/\.json$/, "")}.html`;
  const rel = relative(io.cwd(), resolve(io.cwd(), target));
  if (!target.endsWith(".html") || rel.startsWith("..") || isAbsolute(rel)) {
    io.err(clean(`${target}: is not allowed as the output`));
    io.err("  fix: Write to an .html file inside the current folder.");
    return 2;
  }
  try {
    await io.writeFile(target, result.value);
  } catch {
    io.err(clean(`${target}: cannot write the file`));
    io.err("  fix: Check that the folder exists and you can write to it.");
    return 1;
  }
  io.out(clean(`Wrote ${target}`));
  return 0;
}
