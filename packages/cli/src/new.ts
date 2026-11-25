import { clean, type Io } from "./shared.ts";
import { starter } from "./template.ts";

export async function newFile(io: Io, id: string): Promise<number> {
  const file = `${id}.json`;
  const json = `${JSON.stringify(starter(id, io.today()), null, 2)}\n`;
  let created: boolean;
  try {
    created = await io.createFile(file, json);
  } catch {
    io.err(clean(`${file}: cannot write the file`));
    io.err("  fix: Check that you can write to this folder.");
    return 1;
  }
  if (!created) {
    io.err(clean(`${file} already exists.`));
    io.err("  fix: Pick another id or delete the file.");
    return 1;
  }
  io.out(clean(`Created ${file}. Fill in the TODOs, then run: breachmap validate ${file}`));
  return 0;
}
