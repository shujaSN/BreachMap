import { validate } from "@breachmap/core";
import { clean, type Io, printIssues, readIncident } from "./shared.ts";

export async function validateFiles(io: Io, files: readonly string[]): Promise<number> {
  let failed = false;
  for (const file of files) {
    const input = await readIncident(io, file);
    if (!input.ok) {
      failed = true;
      continue;
    }
    const result = validate(input.value);
    if (result.ok) {
      io.out(clean(`✓ ${file}`));
    } else {
      printIssues(io, file, result.error);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}
