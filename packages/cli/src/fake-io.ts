import { type Issue, validate } from "@breachmap/core";
import type { Io } from "./main.ts";

export const TODAY = "2030-01-02";

// In-memory Io: files in a Map, printed lines in arrays.
export function fake(files: Record<string, string> = {}) {
  const fs = new Map(Object.entries(files));
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    readFile: async (path) => fs.get(path) ?? Promise.reject(new Error(`ENOENT: ${path}`)),
    writeFile: async (path, data) => {
      fs.set(path, data);
    },
    createFile: async (path, data) => {
      if (fs.has(path)) return false;
      fs.set(path, data);
      return true;
    },
    out: (line) => {
      out.push(line);
    },
    err: (line) => {
      err.push(line);
    },
    today: () => TODAY,
    cwd: () => "/work",
  };
  return { io, fs, out, err };
}

export const hasControl = (s: string) =>
  [...s].some((c) => {
    const n = c.codePointAt(0) ?? 0;
    return n < 0x20 || (n >= 0x7f && n <= 0x9f);
  });

export const issuesOf = (text: string): Issue[] => {
  const result = validate(JSON.parse(text));
  return result.ok ? [] : result.error;
};

export const lines = (file: string, issues: Issue[]) =>
  issues.flatMap((i) => [`${file}: ${i.path}: ${i.message}`, `  fix: ${i.fix}`]);
