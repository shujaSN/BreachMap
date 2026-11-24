import { type Incident, IncidentSchema, type SchemaIssue } from "@breachmap/schema";
import { err, ok, type Result } from "./result.ts";

export type Issue = { path: string; message: string; fix: string };

const GENERIC_FIX = "Fix this value.";

const article = (word: string) => `${/^[aeiou]/.test(word) ? "an" : "a"} ${word}`;
const count = (n: number | bigint, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
const unitOf = (origin: string) => (origin === "array" ? "item" : "character");
const kindOf = (value: unknown) =>
  value == null ? String(value) : article(Array.isArray(value) ? "array" : typeof value);
const show = (value: unknown) =>
  typeof value === "string"
    ? JSON.stringify(value)
    : ["number", "boolean", "bigint"].includes(typeof value)
      ? String(value)
      : kindOf(value);
const quote = (values: readonly unknown[]) => values.map(show).join(", ");

export function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "(root)";
  return path
    .map((k, i) => (typeof k === "number" ? `[${k}]` : `${i ? "." : ""}${String(k)}`))
    .join("");
}

function explain(issue: SchemaIssue, key: string | undefined, missing: boolean): [string, string] {
  switch (issue.code) {
    case "invalid_type":
      return missing
        ? ["is missing", `Add "${key}" (${article(issue.expected)}).`]
        : [
            `must be ${article(issue.expected)}, not ${kindOf(issue.input)}`,
            `Change it to ${article(issue.expected)}.`,
          ];
    case "invalid_value": {
      const list = quote(issue.values);
      const allowed = issue.values.length === 1 ? list : `one of: ${list}`;
      return missing
        ? ["is missing", `Add "${key}" with ${allowed}.`]
        : [`${show(issue.input)} is not an allowed value`, `Use ${allowed}.`];
    }
    case "too_small": {
      if (key === "sourceIds") return ["has no source", "Add the id of a source that backs this."];
      const units = count(issue.minimum, unitOf(issue.origin));
      return [`needs at least ${units}`, `Give "${key}" at least ${units}.`];
    }
    case "too_big": {
      const unit = unitOf(issue.origin);
      const length = (issue.input as { length?: number } | undefined)?.length;
      return [
        `is ${length === undefined ? "too" : count(length, unit)} long; the limit is ${issue.maximum}`,
        `Shorten it to ${count(issue.maximum, unit)} or fewer.`,
      ];
    }
    case "unrecognized_keys": {
      const one = issue.keys.length === 1;
      return [
        `has unknown ${one ? "key" : "keys"} ${quote(issue.keys)}`,
        `Remove ${one ? "it" : "them"} or fix the spelling.`,
      ];
    }
    case "custom":
      return [issue.message, issue.params?.fix ?? GENERIC_FIX];
    default:
      return [issue.message, GENERIC_FIX];
  }
}

export function toIssue(issue: SchemaIssue): Issue {
  const key = issue.path.findLast((k): k is string => typeof k === "string");
  const missing = issue.input === undefined && issue.path.length > 0;
  const [message, fix] = explain(issue, key, missing);
  return { path: formatPath(issue.path), message, fix };
}

export function checkSchema(input: unknown): Result<Incident, Issue[]> {
  const parsed = IncidentSchema.safeParse(input, { reportInput: true });
  return parsed.success ? ok(parsed.data) : err(parsed.error.issues.map(toIssue));
}
