import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "scripts/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: { "packages/{schema,core}/src/**": { lines: 90 } },
    },
  },
});
