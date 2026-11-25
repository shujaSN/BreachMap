import { parseArgs } from "node:util";
import { IncidentSchema } from "@breachmap/schema";
import { newFile } from "./new.ts";
import { renderFile } from "./render.ts";
import { clean, type Io, VERSION } from "./shared.ts";
import { validateFiles } from "./validate.ts";

export type { Io } from "./shared.ts";

export const HELP = `Usage: breachmap <command> [options]

Commands:
  validate <file...>        Check incident files. Exit 1 if any is invalid.
  render <file> [-o <out>]  Validate, then write one offline HTML map.
  new <id>                  Create a starter incident file <id>.json.

Options:
  -h, --help                Show this help.
  -v, --version             Show the version.`;

const OPTIONS = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
  out: { type: "string", short: "o" },
} as const;

function usage(io: Io, message: string): number {
  for (const line of `error: ${message}`.split("\n")) io.err(clean(line));
  for (const line of HELP.split("\n")) io.err(line);
  return 2;
}

export async function run(argv: string[], io: Io): Promise<number> {
  let parsed: ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    return usage(io, (error as Error).message);
  }
  const { values, positionals } = parsed;
  const [command, ...args] = positionals;
  if (values.help) {
    for (const line of HELP.split("\n")) io.out(line);
    return 0;
  }
  if (values.version) {
    io.out(VERSION);
    return 0;
  }
  if (values.out !== undefined && command !== "render")
    return usage(io, "-o only works with render");
  if (command === "validate") {
    return args.length > 0
      ? validateFiles(io, args)
      : usage(io, "validate needs at least one file");
  }
  if (command === "render") {
    const [file] = args;
    return file && args.length === 1
      ? renderFile(io, file, values.out)
      : usage(io, "render needs one file");
  }
  const [id] = args;
  if (command === "new" && id !== undefined && args.length === 1) {
    if (IncidentSchema.shape.id.safeParse(id).success) return newFile(io, id);
  }
  if (command === "new") return usage(io, "new needs one id like xz-backdoor-2024");
  return usage(io, command ? `unknown command "${command}"` : "no command given");
}
