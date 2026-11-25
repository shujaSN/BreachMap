import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { run } from "./main.ts";

const created = (error: NodeJS.ErrnoException) =>
  error.code === "EEXIST" ? false : Promise.reject(error);

process.exitCode = await run(process.argv.slice(2), {
  readFile: (path) => readFile(path, "utf8"),
  writeFile: async (path, data) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  },
  createFile: (path, data) => writeFile(path, data, { flag: "wx" }).then(() => true, created),
  out: (line) => {
    process.stdout.write(`${line}\n`);
  },
  err: (line) => {
    process.stderr.write(`${line}\n`);
  },
  today: () => new Date().toISOString().slice(0, 10),
  cwd: () => process.cwd(),
});
