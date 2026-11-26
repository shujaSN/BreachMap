import { err, type Issue, ok, type Result, validate } from "@breachmap/core";
import { page } from "./page.ts";

export type RenderMeta = { version: string };

const MAX_BYTES = 250_000;

export function render(input: unknown, meta: RenderMeta): Result<string, Issue[]> {
  const result = validate(input);
  if (!result.ok) return result;
  const html = page(result.value, meta.version).html;
  const bytes = new TextEncoder().encode(html).length;
  if (bytes <= MAX_BYTES) return ok(html);
  return err([
    {
      path: "(root)",
      message: `makes a ${Math.ceil(bytes / 1000)} KB map; the limit is ${MAX_BYTES / 1000} KB`,
      fix: "Shorten long text, or split the incident into smaller ones.",
    },
  ]);
}
