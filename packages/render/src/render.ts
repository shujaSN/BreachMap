import { type Issue, ok, type Result, validate } from "@breachmap/core";
import { page } from "./page.ts";

export type RenderMeta = { version: string };

export function render(input: unknown, meta: RenderMeta): Result<string, Issue[]> {
  const result = validate(input);
  return result.ok ? ok(page(result.value, meta.version).html) : result;
}
