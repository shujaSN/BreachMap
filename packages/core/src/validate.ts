import { type Incident, PRIMARY_SOURCE_TYPES } from "@breachmap/schema";
import { checkSchema, type Issue } from "./issues.ts";
import { err, type Result } from "./result.ts";

const PRIMARY = new Set<string>(PRIMARY_SOURCE_TYPES);
const PRIMARY_LIST = `${PRIMARY_SOURCE_TYPES.slice(0, -1).join(", ")} or ${PRIMARY_SOURCE_TYPES.at(-1)}`;

const issue = (path: string, message: string, fix: string): Issue[] => [{ path, message, fix }];
const quoted = (ids: Iterable<string>) => [...ids].map((id) => `"${id}"`).join(", ");
const idsOf = (items: readonly { id: string }[]) => new Set(items.map((item) => item.id));

function duplicates(items: readonly { id: string }[], list: string): Issue[] {
  const first = new Map<string, number>();
  return items.flatMap(({ id }, i) => {
    const j = first.get(id);
    if (j !== undefined) {
      return issue(
        `${list}[${i}].id`,
        `"${id}" is already used by ${list}[${j}]`,
        "Give it an id that is unique in this list.",
      );
    }
    first.set(id, i);
    return [];
  });
}

const unknown = (id: string, known: ReadonlySet<string>, path: string, kind: string) =>
  known.has(id)
    ? []
    : issue(
        path,
        `"${id}" is not ${kind} id`,
        `Use one of: ${quoted(known)}, or add ${kind} with this id.`,
      );

function checkList(ids: readonly string[], path: string, known?: ReadonlySet<string>, kind = "") {
  const seen = new Set<string>();
  return ids.flatMap((id, i) => {
    const at = `${path}[${i}]`;
    const repeat = seen.has(id)
      ? issue(at, `"${id}" is already in this list`, "Remove this repeat.")
      : [];
    seen.add(id);
    return [...(known ? unknown(id, known, at, kind) : []), ...repeat];
  });
}

export function checkReferences(incident: Incident): Issue[] {
  const { identifiers, entities, steps, impact, defenses, sources } = incident;
  const [entityIds, stepIds, sourceIds] = [idsOf(entities), idsOf(steps), idsOf(sources)];
  const cited = new Set([...steps, impact, ...defenses].flatMap((item) => item.sourceIds));
  return [
    ...checkList(identifiers?.cve ?? [], "identifiers.cve"),
    ...duplicates(entities, "entities"),
    ...duplicates(steps, "steps"),
    ...steps.flatMap((step, i) => [
      ...unknown(step.from, entityIds, `steps[${i}].from`, "an entity"),
      ...unknown(step.to, entityIds, `steps[${i}].to`, "an entity"),
      ...checkList(step.sourceIds, `steps[${i}].sourceIds`, sourceIds, "a source"),
    ]),
    ...checkList(impact.sourceIds, "impact.sourceIds", sourceIds, "a source"),
    ...duplicates(defenses, "defenses"),
    ...defenses.flatMap((defense, i) => [
      ...checkList(defense.stepIds, `defenses[${i}].stepIds`, stepIds, "a step"),
      ...checkList(defense.sourceIds, `defenses[${i}].sourceIds`, sourceIds, "a source"),
    ]),
    ...duplicates(sources, "sources"),
    ...sources.flatMap((source, i) =>
      cited.has(source.id)
        ? []
        : issue(
            `sources[${i}]`,
            `"${source.id}" is never cited`,
            "Cite it from a step, the impact or a defense, or remove it.",
          ),
    ),
    ...(sources.some((source) => PRIMARY.has(source.type))
      ? []
      : issue("sources", "has no primary source", `Add a source of type ${PRIMARY_LIST}.`)),
  ];
}

export function validate(input: unknown): Result<Incident, Issue[]> {
  const result = checkSchema(input);
  if (!result.ok) return result;
  const issues = checkReferences(result.value);
  return issues.length ? err(issues) : result;
}
