import { describe, expect, expectTypeOf, it } from "vitest";
import { err, ok, type Result } from "./index.ts";

describe("Result", () => {
  it("FR-5: ok wraps a value", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("FR-5: err wraps an error", () => {
    expect(err(["bad"])).toEqual({ ok: false, error: ["bad"] });
  });

  it("FR-5: ok and err fit a Result", () => {
    expectTypeOf(ok(42)).toExtend<Result<number, string>>();
    expectTypeOf(err("bad")).toExtend<Result<number, string>>();
  });

  it("FR-5: narrows on the ok flag", () => {
    const result = ok("x") as Result<string, number>;
    if (result.ok) expectTypeOf(result.value).toEqualTypeOf<string>();
    else expectTypeOf(result.error).toEqualTypeOf<number>();
  });
});
