import { z } from "zod";

export const TACTICS = {
  reconnaissance: { id: "TA0043", name: "Reconnaissance" },
  "resource-development": { id: "TA0042", name: "Resource Development" },
  "initial-access": { id: "TA0001", name: "Initial Access" },
  execution: { id: "TA0002", name: "Execution" },
  persistence: { id: "TA0003", name: "Persistence" },
  "privilege-escalation": { id: "TA0004", name: "Privilege Escalation" },
  stealth: { id: "TA0005", name: "Stealth" },
  "defense-impairment": { id: "TA0112", name: "Defense Impairment" },
  "credential-access": { id: "TA0006", name: "Credential Access" },
  discovery: { id: "TA0007", name: "Discovery" },
  "lateral-movement": { id: "TA0008", name: "Lateral Movement" },
  collection: { id: "TA0009", name: "Collection" },
  "command-and-control": { id: "TA0011", name: "Command and Control" },
  exfiltration: { id: "TA0010", name: "Exfiltration" },
  impact: { id: "TA0040", name: "Impact" },
} as const;

export type Tactic = keyof typeof TACTICS;

export const SOURCE_TYPES = ["advisory", "cve", "vendor", "report", "research", "news"] as const;
export const PRIMARY_SOURCE_TYPES = ["advisory", "cve", "vendor", "report"] as const;

const DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

function isDate(value: string, full: boolean): boolean {
  const [, year, m = "01", d = "01"] = DATE.exec(value) ?? [];
  if (!year || (full && value.length !== 10)) return false;
  const [y, month, day] = [Number(year), Number(m) - 1, Number(d)];
  return month >= 0 && month < 12 && day > 0 && Date.UTC(y, month, day) < Date.UTC(y, month + 1, 1);
}

const rule = (test: RegExp | ((value: string) => boolean), error: string, fix: string) =>
  z
    .string()
    .refine(test instanceof RegExp ? (v) => test.test(v) : test, { error, params: { fix } });

const text = (max: number) => rule(/\S/, "must not be blank", "Write some text.").max(max);

const id = rule(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "must be a lowercase slug like xz-backdoor-2024",
  "Use only lowercase letters, digits and single hyphens.",
).max(64);

const date = rule(
  (v) => isDate(v, false),
  "must be a real date like 2024-03-29, 2024-03 or 2024",
  "Use YYYY-MM-DD, YYYY-MM or YYYY, or null if unknown.",
).nullable();

const fullDate = rule(
  (v) => isDate(v, true),
  "must be a real date like 2024-03-29",
  "Use YYYY-MM-DD.",
);

const cve = rule(
  /^CVE-\d{4}-\d{4,}$/,
  "must be a CVE ID like CVE-2024-3094",
  "Use CVE-YYYY-NNNN with at least 4 digits at the end.",
);

const techniqueId = rule(
  /^T\d{4}(?:\.\d{3})?$/,
  "must be an ATT&CK technique ID like T1195 or T1195.002",
  "Use T and 4 digits, optionally a dot and 3 digits, or remove the field.",
);

const url = z
  .string()
  .refine((v) => !/\s/.test(v) && URL.canParse(v), {
    error: "must be a valid URL",
    params: { fix: "Use the full address of the page, starting with https://." },
    abort: true,
  })
  .refine((v) => URL.parse(v)?.protocol === "https:", {
    error: "must use https",
    params: { fix: "Use the https:// address of the page." },
  });

const sourceIds = z.array(id).min(1);

export const IncidentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id,
  title: text(120),
  summary: text(500),
  dates: z.strictObject({ started: date, discovered: date, disclosed: date }),
  identifiers: z.strictObject({ cve: z.array(cve).min(1) }).optional(),
  entities: z
    .array(z.strictObject({ id, name: text(80), kind: z.enum(["attacker", "victim", "system"]) }))
    .min(1),
  steps: z
    .array(
      z.strictObject({
        id,
        title: text(120),
        description: text(600),
        phase: z.enum(Object.keys(TACTICS) as [Tactic, ...Tactic[]]),
        techniqueId: techniqueId.optional(),
        from: id,
        to: id,
        confidence: z.enum(["confirmed", "reported", "disputed"]),
        sourceIds,
      }),
    )
    .min(1),
  impact: z.strictObject({ description: text(600), sourceIds }),
  defenses: z
    .array(z.strictObject({ id, action: text(300), stepIds: z.array(id), sourceIds }))
    .min(1),
  sources: z
    .array(
      z.strictObject({
        id,
        url,
        title: text(300),
        publisher: text(120),
        type: z.enum(SOURCE_TYPES),
        retrievedAt: fullDate,
      }),
    )
    .min(2),
  provenance: z
    .strictObject({
      createdBy: z.enum(["human", "skill"]),
      skillVersion: rule(
        /^\d+\.\d+\.\d+$/,
        "must be a version like 0.1.0",
        "Use MAJOR.MINOR.PATCH, e.g. 0.1.0.",
      ).optional(),
      createdAt: fullDate,
      reviewedBy: text(80).optional(),
    })
    .refine((p) => p.createdBy !== "skill" || p.skillVersion !== undefined, {
      error: "is required when createdBy is skill",
      path: ["skillVersion"],
      params: { fix: "Add the version of the skill that made this file, e.g. 0.1.0." },
    }),
});

export type Incident = z.infer<typeof IncidentSchema>;
