import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { render } from "./index.ts";

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), "utf8"));

const renderOk = (input: unknown) => {
  const result = render(input, { version: "0.1.0" });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
};

const parse = (page: string) => new new Window().DOMParser().parseFromString(page, "text/html");

const xss = load("xss.json");
const xssPage = renderOk(xss);
const doc = parse(xssPage);

// Builds a large incident: 6 entities, 60 steps, 40 sources and 30 defenses at max text lengths.
function big(fill?: string) {
  const text = (letter: string, n: number) => (fill ?? letter).repeat(n);
  const data = load("valid.json");
  const kinds = ["attacker", "victim", "system", "system", "system", "system"];
  data.entities = kinds.map((kind, i) => ({ id: `entity-${i}`, name: text("N", 80), kind }));
  data.sources = Array.from({ length: 40 }, (_, i) => ({
    id: `source-${i}`,
    url: `https://example.com/source/${i}`,
    title: text("T", 300),
    publisher: text("P", 120),
    type: i % 2 ? "advisory" : "news",
    retrievedAt: "2026-11-24",
  }));
  data.steps = Array.from({ length: 60 }, (_, i) => ({
    id: `step-${i}`,
    title: text("S", 120),
    description: text("D", 600),
    phase: "execution",
    techniqueId: "T1059.001",
    from: `entity-${i % 6}`,
    to: `entity-${(i + 1) % 6}`,
    confidence: "reported",
    sourceIds: [`source-${i % 40}`, `source-${(i + 7) % 40}`],
  }));
  data.impact = { description: text("I", 600), sourceIds: ["source-0"] };
  data.defenses = Array.from({ length: 30 }, (_, i) => ({
    id: `defense-${i}`,
    action: text("A", 300),
    stepIds: [0, 1, 2, 3, 4].map((k) => `step-${(i + k * 12) % 60}`),
    sourceIds: [`source-${i}`],
  }));
  return data;
}

describe("AC3: hostile text renders as visible text and nothing executes", () => {
  it.each([
    ["the title", "h1", xss.title],
    ["the summary", "p.summary", xss.summary],
    ["a step title", "#step-phishing-email h3 bdi", xss.steps[0].title],
    ["a step description", "#step-phishing-email > p:not([class])", xss.steps[0].description],
    ["the impact", "#impact > p:not([class])", xss.impact.description],
    ["a defense action", "#def-phishing-resistant-mfa span", xss.defenses[0].action],
    ["a source title", "#src-example-advisory a bdi", xss.sources[0].title],
    ["a source publisher", "#src-example-advisory .source-meta bdi", xss.sources[0].publisher],
    ["the reviewer", "footer bdi", xss.provenance.reviewedBy],
  ])("NFR-1: shows %s exactly as written", (_, selector, text) => {
    expect(doc.querySelector(selector)?.textContent).toBe(text);
  });

  it("NFR-1: has only the page's own script and style", () => {
    expect([doc.querySelectorAll("script").length, doc.querySelectorAll("style").length]).toEqual([
      1, 1,
    ]);
  });

  it("NFR-1: adds no injected elements", () => {
    for (const tag of [
      "img",
      "iframe",
      "object",
      "embed",
      "link",
      "base",
      "form",
      "meta[http-equiv=refresh]",
    ]) {
      expect(doc.querySelectorAll(tag).length, tag).toBe(0);
    }
    expect(doc.querySelectorAll("svg").length).toBe(1);
  });

  it("NFR-1: no element has an event handler or style attribute", () => {
    const attributes = [...doc.querySelectorAll("*")].flatMap((el) =>
      [...el.attributes].map((a) => a.name),
    );
    expect(attributes.filter((name) => name.startsWith("on") || name === "style")).toEqual([]);
  });

  it("NFR-1: the hostile source URL stays inside its href", () => {
    expect(doc.querySelector("#src-example-advisory a")?.getAttribute("href")).toBe(
      new URL(xss.sources[0].url).href,
    );
  });
});

describe("AC4, NFR-2: determinism", () => {
  it.each(["xss.json"])("renders %s to identical bytes twice", (name) => {
    expect(renderOk(load(name))).toBe(renderOk(load(name)));
  });
});

describe("NFR-1: no network requests", () => {
  it.each([
    ["valid.json", renderOk(load("valid.json"))],
    ["xss.json", xssPage],
  ])("%s loads nothing from the network", (_, page) => {
    const d = parse(page);
    const attrs = [...d.querySelectorAll("*")].flatMap((el) =>
      [...el.attributes].map((a) => [a.name, a.value]),
    );
    expect(attrs.filter(([name]) => /^(src|srcset|poster|data|action)$/.test(name ?? ""))).toEqual(
      [],
    );
    expect(
      attrs.filter(([name, value]) => name !== "href" && /https?:/i.test(value ?? "")),
    ).toEqual([]);
    expect(
      d.querySelectorAll("link, img, iframe, object, embed, video, audio, source").length,
    ).toBe(0);
    expect(d.querySelector("style")?.textContent).not.toMatch(/url\(|@import|@font-face/i);
  });
});

describe("NFR-4, NFR-7: budget for a large incident (6 entities, 60 steps, 40 sources, 30 defenses)", () => {
  it("NFR-4: stays at or under 250 KB", () => {
    expect(Buffer.byteLength(renderOk(big()), "utf8")).toBeLessThanOrEqual(250_000);
  });

  it("NFR-7: validates and renders in under 1 second", () => {
    const input = big();
    const start = performance.now();
    renderOk(input);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe("NFR-4: the size budget is enforced", () => {
  it("refuses a valid incident whose map would be over 250 KB, with a fix", () => {
    const result = render(big("漢"), { version: "0.1.0" });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.error).toEqual([
      {
        path: "(root)",
        message: expect.stringMatching(/^makes a \d+ KB map; the limit is 250 KB$/),
        fix: "Shorten long text, or split the incident into smaller ones.",
      },
    ]);
  });
});
