import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { validate } from "@breachmap/core";
import { TACTICS } from "@breachmap/schema";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { render } from "./index.ts";

const fixtures = new URL("../../../fixtures/", import.meta.url);
const load = (name: string) => JSON.parse(readFileSync(new URL(name, fixtures), "utf8"));
const valid = load("valid.json");
const META = { version: "0.1.0" };

// Returns a changed copy of the valid fixture.
function edit(change: (d: typeof valid) => void) {
  const data = structuredClone(valid);
  change(data);
  return data;
}

function page(input: unknown = valid, version = META.version): string {
  const result = render(input, { version });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const win = new Window();
const parse = (out: string) => new win.DOMParser().parseFromString(out, "text/html");
const dom = (input?: unknown) => parse(page(input));

type Doc = ReturnType<typeof parse>;
type El = NonNullable<ReturnType<Doc["querySelector"]>>;
type Root = Doc | El;

const text = (el: { textContent: string | null } | null) =>
  (el?.textContent ?? "").replace(/\s+/g, " ").trim();

function one(root: Root, selector: string): El {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

const all = (root: Root, selector: string): El[] => [...root.querySelectorAll(selector)];
const texts = (root: Root, selector: string) => all(root, selector).map(text);
const links = (root: Root) => all(root, "a").map((a) => [a.getAttribute("href"), text(a)]);
const attrs = (el: El) =>
  Object.fromEntries(el.getAttributeNames().map((n) => [n, el.getAttribute(n)]));
const link = (a: El) => ({
  href: a.getAttribute("href"),
  rel: a.getAttribute("rel"),
  text: text(a),
});
const sha = (s: string) => createHash("sha256").update(s).digest("base64");
const inner = (out: string, tag: string) =>
  [...out.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1] ?? "");

const STEP_IDS = ["phishing-email", "build-server-login", "tampered-release"];

const INVALID: [string, unknown][] = [
  ["null", null],
  ["a string", "incident"],
  ["an empty object", {}],
  ...readdirSync(new URL("invalid/", fixtures))
    .filter((f) => f.endsWith(".json"))
    .map((f): [string, unknown] => [f, load(`invalid/${f}`)]),
];

const FOOTERS: [string, Record<string, string>, string][] = [
  [
    "skill, reviewed",
    { createdBy: "skill", skillVersion: "0.1.0", createdAt: "2026-11-24", reviewedBy: "Ann" },
    "Schema version 1 · Created by the Breachmap skill 0.1.0 on 2026-11-24 · Reviewed by Ann · Made with Breachmap 0.1.0",
  ],
  [
    "skill, not reviewed",
    { createdBy: "skill", skillVersion: "1.2.3", createdAt: "2026-11-20" },
    "Schema version 1 · Created by the Breachmap skill 1.2.3 on 2026-11-20 · Not reviewed yet · Made with Breachmap 0.1.0",
  ],
  [
    "human, reviewed",
    { createdBy: "human", createdAt: "2026-11-24", reviewedBy: "Ann" },
    "Schema version 1 · Created by hand on 2026-11-24 · Reviewed by Ann · Made with Breachmap 0.1.0",
  ],
  [
    "human, not reviewed",
    { createdBy: "human", createdAt: "2026-11-24" },
    "Schema version 1 · Created by hand on 2026-11-24 · Not reviewed yet · Made with Breachmap 0.1.0",
  ],
];

describe("render: input", () => {
  it("FR-7: renders a valid incident to a string", () => {
    expect(render(valid, META)).toEqual({ ok: true, value: expect.any(String) });
  });

  it.each(INVALID)("FR-7: refuses %s with the issues validate returns", (_, input) => {
    expect(render(input, META)).toEqual(validate(input));
  });

  it("FR-7: refuses an http source URL", () => {
    expect(render(load("invalid/http-url.json"), META)).toEqual({
      ok: false,
      error: [
        {
          path: "sources[0].url",
          message: "must use https",
          fix: "Use the https:// address of the page.",
        },
      ],
    });
  });
});

describe("render: document", () => {
  it("FR-7: starts with <!doctype html>", () => {
    expect(page().startsWith("<!doctype html>")).toBe(true);
  });

  it("FR-7: sets lang en on html", () => {
    expect(dom().documentElement.getAttribute("lang")).toBe("en");
  });

  it("NFR-1: head starts with charset, CSP, referrer, DNS prefetch and viewport metas", () => {
    const first = [...dom().head.children].slice(0, 5);
    expect(first.map((el) => el.localName)).toEqual(["meta", "meta", "meta", "meta", "meta"]);
    expect(first.map(attrs)).toEqual([
      { charset: "utf-8" },
      { "http-equiv": "Content-Security-Policy", content: expect.any(String) },
      { name: "referrer", content: "no-referrer" },
      { "http-equiv": "x-dns-prefetch-control", content: "off" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ]);
  });

  it("FR-8: title is the incident title and Breachmap", () => {
    expect(dom().title).toBe("⁨Example Corp build server compromise⁩ · Breachmap");
  });

  it("NFR-1: has one style, in the head", () => {
    const doc = dom();
    expect(all(doc, "style").map((el) => el.parentElement)).toEqual([doc.head]);
  });

  it("NFR-1: has one script, the last element of body", () => {
    const doc = dom();
    expect(all(doc, "script")).toEqual([doc.body.lastElementChild]);
  });

  it("NFR-1: CSP allows only the page's own script and style by hash", () => {
    const out = page();
    const [script = "", ...moreScripts] = inner(out, "script");
    const [style = "", ...moreStyles] = inner(out, "style");
    expect([moreScripts, moreStyles]).toEqual([[], []]);
    expect(
      one(parse(out), 'meta[http-equiv="Content-Security-Policy"]').getAttribute("content"),
    ).toBe(
      `default-src 'none'; script-src 'sha256-${sha(script)}'; style-src 'sha256-${sha(style)}'; base-uri 'none'; form-action 'none'`,
    );
  });

  it("NFR-1: CSP meta comes before any style or script", () => {
    const doc = dom();
    const els = all(doc, "*");
    const csp = els.indexOf(one(doc, 'meta[http-equiv="Content-Security-Policy"]'));
    const firstCode = els.findIndex((el) => el.matches("style, script"));
    expect(csp).toBeGreaterThanOrEqual(0);
    expect(csp).toBeLessThan(firstCode);
  });

  it("NFR-1: no element has a style attribute", () => {
    expect(all(dom(), "[style]")).toEqual([]);
  });
});

describe("render: header", () => {
  it("FR-8: shows the kicker", () => {
    expect(text(one(dom(), "header.top p.kicker"))).toBe("Breachmap attack map");
  });

  it("FR-8: h1 is the title", () => {
    expect(text(one(dom(), "header.top h1"))).toBe("Example Corp build server compromise");
  });

  it("FR-8: shows the summary", () => {
    expect(text(one(dom(), "header.top p.summary"))).toBe(valid.summary);
  });

  it("FR-8: facts list the dates, Unknown for null, and the CVE", () => {
    const dl = one(dom(), "header.top dl.facts");
    expect([texts(dl, "dt"), texts(dl, "dd")]).toEqual([
      ["Started", "Discovered", "Disclosed", "CVE"],
      ["2024-02", "2024-03-29", "Unknown", "CVE-2099-0001"],
    ]);
  });

  it("FR-8: facts show Unknown for every null date", () => {
    const input = edit((d) => {
      d.dates = { started: null, discovered: null, disclosed: null };
    });
    expect(texts(one(dom(input), "dl.facts"), "dd").slice(0, 3)).toEqual([
      "Unknown",
      "Unknown",
      "Unknown",
    ]);
  });

  it("FR-8: facts join several CVEs with a comma", () => {
    const input = edit((d) => {
      d.identifiers.cve = ["CVE-2099-0001", "CVE-2099-12345"];
    });
    expect(texts(one(dom(input), "dl.facts"), "dd")[3]).toBe("CVE-2099-0001, CVE-2099-12345");
  });

  it("FR-8: facts have no CVE without identifiers", () => {
    const input = edit((d) => {
      delete d.identifiers;
    });
    expect(texts(one(dom(input), "dl.facts"), "dt")).toEqual([
      "Started",
      "Discovered",
      "Disclosed",
    ]);
  });
});

describe("render: steps", () => {
  const steps = (input?: unknown) => all(dom(input), "section#flow ol.steps > li.step");

  it("FR-8: flow has the Attack flow heading", () => {
    expect(text(one(dom(), "section#flow h2"))).toBe("Attack flow");
  });

  it("FR-8: one li.step per step, in order", () => {
    expect(steps().map((li) => li.id)).toEqual(STEP_IDS.map((id) => `step-${id}`));
  });

  it("FR-9: data-sources lists each step's sources", () => {
    expect(steps().map((li) => li.getAttribute("data-sources"))).toEqual([
      "src-example-advisory",
      "src-example-news",
      "src-example-vendor",
    ]);
  });

  it("FR-9: data-sources joins several sources with a space", () => {
    const input = edit((d) => {
      d.steps[0].sourceIds = ["example-advisory", "example-news"];
    });
    expect(steps(input)[0]?.getAttribute("data-sources")).toBe(
      "src-example-advisory src-example-news",
    );
  });

  it("FR-8: h3 has the step number then the title", () => {
    const heads = steps().map((li) => {
      const n = text(one(li, "h3 span.n"));
      return [n, text(one(li, "h3")).slice(n.length).trim()];
    });
    expect(heads).toEqual([
      ["1", "Phishing email to an engineer"],
      ["2", "Login to the build server"],
      ["3", "Backdoor added to the build script"],
    ]);
  });

  it("FR-8, FR-10: meta has the phase, then the technique, then the badge", () => {
    expect(steps().map((li) => [...one(li, "p.meta").children].map(text))).toEqual([
      ["Initial Access", "T1566.002"],
      ["Lateral Movement", "Reported"],
      ["Persistence"],
    ]);
  });

  it.each(Object.entries(TACTICS))("FR-8: phase %s shows its tactic name", (phase, { name }) => {
    const input = edit((d) => {
      d.steps[0].phase = phase;
    });
    expect(text(one(dom(input), "#step-phishing-email p.meta span.phase"))).toBe(name);
  });

  it.each([
    ["T1566.002", "https://attack.mitre.org/techniques/T1566/002/"],
    ["T1195", "https://attack.mitre.org/techniques/T1195/"],
  ])("FR-8: technique %s links to %s", (techniqueId, href) => {
    const input = edit((d) => {
      d.steps[0].techniqueId = techniqueId;
    });
    const a = one(dom(input), "#step-phishing-email p.meta a.technique");
    expect([a.getAttribute("href"), text(a)]).toEqual([href, techniqueId]);
  });

  it("FR-8: a step without a technique has no technique link", () => {
    const doc = dom();
    expect(doc.querySelector("#step-build-server-login a.technique")).toBeNull();
    expect(all(doc, "a.technique")).toHaveLength(1);
  });

  it("FR-10: a reported step has a Reported badge", () => {
    expect(text(one(dom(), "#step-build-server-login span.badge.reported"))).toBe("Reported");
  });

  it("FR-10: a disputed step has a Disputed badge", () => {
    const input = edit((d) => {
      d.steps[0].confidence = "disputed";
    });
    const badges = all(dom(input), "#step-phishing-email .badge");
    expect(badges.map((el) => [el.matches("span.badge.disputed"), text(el)])).toEqual([
      [true, "Disputed"],
    ]);
  });

  it("FR-10: a confirmed step has no badge", () => {
    const doc = dom();
    expect(all(doc, "#step-phishing-email .badge, #step-tampered-release .badge")).toEqual([]);
  });

  it("FR-8: actors show the from and to entity names", () => {
    expect(steps().map((li) => texts(li, "p.actors bdi"))).toEqual([
      ["Example Threat Group", "Example Corp"],
      ["Example Threat Group", "Example Corp build server"],
      ["Example Corp build server", "Example Corp build server"],
    ]);
  });

  it("FR-8: each step shows its description", () => {
    const shown = steps().map((li) => texts(li, "p"));
    for (const [i, step] of valid.steps.entries()) expect(shown[i]).toContain(step.description);
  });

  it("FR-8: cites start with Sources and link each source by its number", () => {
    const cites = steps().map((li) => one(li, "p.cites"));
    expect(cites.map((p) => text(p).startsWith("Sources:"))).toEqual([true, true, true]);
    expect(cites.map(links)).toEqual([
      [["#src-example-advisory", "[1]"]],
      [["#src-example-news", "[3]"]],
      [["#src-example-vendor", "[2]"]],
    ]);
  });

  it("FR-8: cites link every source of a step", () => {
    const input = edit((d) => {
      d.steps[0].sourceIds = ["example-advisory", "example-news"];
    });
    expect(links(one(dom(input), "#step-phishing-email p.cites"))).toEqual([
      ["#src-example-advisory", "[1]"],
      ["#src-example-news", "[3]"],
    ]);
  });
});

describe("render: impact", () => {
  it("FR-8: impact has the Impact heading", () => {
    expect(text(one(dom(), "section#impact h2"))).toBe("Impact");
  });

  it("FR-8: impact shows its description", () => {
    expect(texts(one(dom(), "section#impact"), "p")).toContain(valid.impact.description);
  });

  it("FR-8: impact cites link its sources", () => {
    const p = one(dom(), "section#impact p.cites");
    expect([text(p).startsWith("Sources:"), links(p)]).toEqual([
      true,
      [["#src-example-vendor", "[2]"]],
    ]);
  });
});

describe("render: defenses", () => {
  const items = (input?: unknown) => all(dom(input), "section#defenses ul.checklist > li");

  it("FR-8: defenses have the Defenses heading", () => {
    expect(text(one(dom(), "section#defenses h2"))).toBe("Defenses");
  });

  it("FR-8: one li per defense, in order", () => {
    expect(items().map((li) => li.id)).toEqual(["def-phishing-resistant-mfa", "def-verify-builds"]);
  });

  it("FR-8: each defense has a checkbox in a label", () => {
    expect(items().map((li) => li.querySelector("label > input[type=checkbox]") !== null)).toEqual([
      true,
      true,
    ]);
  });

  it("FR-8: each defense shows its action in a span", () => {
    expect(items().map((li) => text(one(li, "span")))).toEqual(
      valid.defenses.map((d: { action: string }) => d.action),
    );
  });

  it("FR-9: cites link the addressed steps, then the sources", () => {
    const cites = items().map((li) => one(li, "p.cites"));
    expect(cites.map((p) => text(p).startsWith("Addresses:"))).toEqual([true, true]);
    expect(cites.map(links)).toEqual([
      [
        ["#step-phishing-email", "Step 1"],
        ["#step-build-server-login", "Step 2"],
        ["#src-example-advisory", "[1]"],
      ],
      [
        ["#step-tampered-release", "Step 3"],
        ["#src-example-vendor", "[2]"],
      ],
    ]);
  });

  it("FR-9: a defense with no steps has no Addresses", () => {
    const input = edit((d) => {
      d.defenses[1].stepIds = [];
    });
    const p = one(dom(input), "#def-verify-builds p.cites");
    expect([text(p).includes("Addresses"), links(p)]).toEqual([
      false,
      [["#src-example-vendor", "[2]"]],
    ]);
  });
});

describe("render: sources", () => {
  const items = () => all(dom(), "section#sources ol.sources > li");

  it("FR-8: sources have the Sources heading", () => {
    expect(text(one(dom(), "section#sources h2"))).toBe("Sources");
  });

  it("FR-8: one li per source, in order", () => {
    expect(items().map((li) => li.id)).toEqual([
      "src-example-advisory",
      "src-example-vendor",
      "src-example-news",
    ]);
  });

  it("FR-8: each source links its title to its URL", () => {
    expect(items().map((li) => link(one(li, "a")))).toEqual(
      valid.sources.map((s: { url: string; title: string }) => ({
        href: s.url,
        rel: "noopener noreferrer",
        text: s.title,
      })),
    );
  });

  it("FR-8: each source shows publisher, type and retrieved date", () => {
    expect(items().map((li) => text(one(li, "span.source-meta")))).toEqual([
      "Example CERT · advisory · retrieved 2026-11-24",
      "Example Corp · vendor · retrieved 2026-11-24",
      "Example News · news · retrieved 2026-11-24",
    ]);
  });
});

describe("render: footer", () => {
  it.each(FOOTERS)("FR-12: footer for %s", (_, provenance, expected) => {
    const input = edit((d) => {
      d.provenance = provenance;
    });
    expect(text(one(dom(input), "footer"))).toBe(expected);
  });
});

describe("render: no JavaScript", () => {
  it("FR-11: no element is hidden", () => {
    expect(all(dom(), "[hidden]")).toEqual([]);
  });

  it("FR-11: every step, source and defense text is in the page", () => {
    const body = text(dom().body);
    const wanted = [
      ...valid.steps.flatMap((s: { title: string; description: string }) => [
        s.title,
        s.description,
      ]),
      ...valid.sources.map((s: { title: string }) => s.title),
      ...valid.defenses.map((d: { action: string }) => d.action),
    ];
    expect(wanted.filter((w) => !body.includes(w))).toEqual([]);
  });
});

describe("render: links", () => {
  it("NFR-1: every href is https or a #anchor", () => {
    const hrefs = all(dom(), "[href]").map((el) => el.getAttribute("href") ?? "");
    expect(hrefs.filter((h) => !/^(https:\/\/|#)/.test(h))).toEqual([]);
  });

  it("NFR-1: every external link has rel noopener noreferrer", () => {
    const external = all(dom(), 'a[href^="https:"]');
    expect(external.length).toBeGreaterThan(0);
    expect(external.map((a) => a.getAttribute("rel"))).toEqual(
      external.map(() => "noopener noreferrer"),
    );
  });

  it("FR-9: every #anchor points to an element on the page", () => {
    const doc = dom();
    const targets = all(doc, 'a[href^="#"]').map((a) => (a.getAttribute("href") ?? "").slice(1));
    expect(targets.filter((id) => !doc.getElementById(id))).toEqual([]);
  });
});

describe("render: determinism", () => {
  it("NFR-2: the same input renders the same string twice", () => {
    expect(page(structuredClone(valid))).toBe(page(structuredClone(valid)));
  });

  it("NFR-2: meta.version appears in the output", () => {
    expect(text(one(parse(page(valid, "9.8.7")), "footer"))).toContain("Made with Breachmap 9.8.7");
  });

  it("NFR-2, NFR-8: valid.json matches the file snapshot", async () => {
    await expect(page()).toMatchFileSnapshot("./__snapshots__/valid.html");
  });
});

describe("render: odd https URLs", () => {
  it.each(["HTTPS://example.com/x", "https:example.com/x", "https:/example.com/x"])(
    "FR-7, NFR-1: renders the valid URL %s as its normal https:// form",
    (url) => {
      const data = JSON.parse(
        readFileSync(new URL("../../../fixtures/valid.json", import.meta.url), "utf8"),
      );
      data.sources[0].url = url;
      const result = render(data, { version: "0.1.0" });
      expect(result.ok && result.value).toContain('href="https://example.com/x"');
    },
  );
});
