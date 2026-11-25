import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { isolate } from "./bidi.ts";
import { render } from "./index.ts";

const valid = JSON.parse(
  readFileSync(new URL("../../../fixtures/valid.json", import.meta.url), "utf8"),
);

describe("isolate", () => {
  it.each([
    ["plain text", "Acme", "⁨Acme⁩"],
    ["an override", "Acme‮ hack", "⁨Acme‮ hack⁩"],
    ["its own isolate closer", "Acme⁩‮ hack", "⁨Acme‮ hack⁩"],
    ["every isolate character", "a⁦b⁧c⁨d⁩e", "⁨abcde⁩"],
  ])("NFR-1: wraps %s so it cannot reorder text after it", (_, text, out) => {
    expect(isolate(text)).toBe(out);
  });

  it("NFR-1: the page and arrow titles keep a closing isolate an incident cannot cancel", () => {
    const input = structuredClone(valid);
    input.title = "Acme⁩‮ hack";
    input.steps[1].title = "Login⁩‮ x";
    const result = render(input, { version: "0.1.0" });
    const doc = new new Window().DOMParser().parseFromString(
      result.ok ? result.value : "",
      "text/html",
    );
    expect(doc.title).toBe("⁨Acme‮ hack⁩ · Breachmap");
    expect(doc.querySelectorAll("a.arrow > title")[1]?.textContent).toBe(
      "Step 2: ⁨Login‮ x⁩ (reported)",
    );
  });
});
