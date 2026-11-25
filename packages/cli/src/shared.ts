import { err, type Issue, ok, type Result } from "@breachmap/core";
import pkg from "../package.json" with { type: "json" };

export type Io = {
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  createFile(path: string, data: string): Promise<boolean>;
  out(line: string): void;
  err(line: string): void;
  today(): string;
  cwd(): string;
};

export const VERSION = pkg.version;

export const clean = (text: string) => text.replace(/\p{Cc}/gu, "\uFFFD");

export function printIssues(io: Io, file: string, issues: readonly Issue[]): void {
  for (const issue of issues) {
    io.err(clean(`${file}: ${issue.path}: ${issue.message}`));
    io.err(clean(`  fix: ${issue.fix}`));
  }
}

export async function readIncident(io: Io, file: string): Promise<Result<unknown, null>> {
  let text: string;
  try {
    text = await io.readFile(file);
  } catch {
    io.err(clean(`${file}: cannot read the file`));
    io.err("  fix: Check the path.");
    return err(null);
  }
  try {
    return ok(JSON.parse(text.replace(/^\uFEFF/, "")));
  } catch {
    printIssues(io, file, [
      { path: "(root)", message: "is not valid JSON", fix: "Fix the JSON syntax." },
    ]);
    return err(null);
  }
}
