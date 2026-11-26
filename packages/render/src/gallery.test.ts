import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { layout, validate } from "@breachmap/core";
import { type Incident, TACTICS } from "@breachmap/schema";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { type Evals, type GalleryMeta, renderGallery } from "./gallery.ts";

const at = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(at(path), "utf8"));

function check(data: unknown): Incident {
  const result = validate(data);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const GALLERY = readdirSync(at("gallery/incidents/"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => check(read(`gallery/incidents/${f}`)));
const XSS = check(read("fixtures/xss.json"));
const VALID = check(read("fixtures/valid.json"));

const EVALS: Evals = {
  date: "2026-11-25",
  skillVersion: "0.1.0",
  E1: 1,
  E2: 0,
  E3: 1,
  E4: 0.8064516129032258,
  provisional: true,
};
const META: GalleryMeta = { version: "0.1.0", evals: EVALS };

type Confidence = Incident["steps"][number]["confidence"];
const CONFIDENCE = ["confirmed", "reported", "disputed"] as const;
const NO_DATES = { started: null, discovered: null, disclosed: null };
const OLD = { started: null, discovered: null, disclosed: "2021-01" };

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const when = ({ dates: d }: Incident) => d.disclosed ?? d.discovered ?? d.started;
// Newest first; "" puts undated incidents last; ties by id.
const newest = (list: readonly Incident[]) =>
  [...list].sort((a, b) => compare(when(b) ?? "", when(a) ?? "") || compare(a.id, b.id));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const tally = (d: Incident) =>
  CONFIDENCE.map((c) => [c, d.steps.filter((s) => s.confidence === c).length] as const)
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${n} ${c}`)
    .join(" · ");

const SORTED = newest(GALLERY);
const CASES = SORTED.map((d, i) => ({
  n: i + 1,
  id: d.id,
  d,
  year: when(d)?.slice(0, 4) ?? "Unknown",
  cve: d.identifiers?.cve ?? [],
  strip: tally(d),
  review: d.provenance.reviewedBy ? `Reviewed by ${d.provenance.reviewedBy}` : "Not reviewed yet",
}));

// Returns fixtures/valid.json with the change applied, validated again.
function variant(change: (d: Incident) => void): Incident {
  const copy = structuredClone(VALID);
  change(copy);
  return check(copy);
}

const dated = (id: string, dates: Incident["dates"]) =>
  variant((d) => {
    d.id = id;
    d.dates = dates;
  });

const win = new Window();
const parse = (out: string) => new win.DOMParser().parseFromString(out, "text/html");
const page = (incidents: readonly Incident[] = GALLERY, meta: GalleryMeta = META) =>
  renderGallery(incidents, meta);
const dom = (incidents?: readonly Incident[], meta?: GalleryMeta) => parse(page(incidents, meta));

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

function nth(els: El[], n: number): El {
  const el = els[n - 1];
  if (!el) throw new Error(`missing item ${n}`);
  return el;
}

const all = (root: Root, selector: string): El[] => [...root.querySelectorAll(selector)];
const texts = (root: Root, selector: string) => all(root, selector).map(text);
const attrs = (el: El) =>
  Object.fromEntries(el.getAttributeNames().map((n) => [n, el.getAttribute(n)]));
const link = (a: El) => ({ href: a.getAttribute("href"), text: text(a) });
const href = (id: string) => `maps/${id}.html`;
const short = (title: string) => title.split(/: | \(/)[0];
const word = (phrase: string) => new RegExp(`(?<![\\w-])${phrase}(?![\\w-])`);
const sha = (s: string) => createHash("sha256").update(s).digest("base64");
const inner = (out: string, tag: string) =>
  [...out.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1] ?? "");
const confidenceOf = (el: El) => CONFIDENCE.find((c) => el.classList.contains(c));
const confidences = (d: Incident) => d.steps.map((s) => s.confidence);
const cves = (s: string) => s.match(/CVE-\d{4}-\d+/g) ?? [];

const cards = (doc: Doc = dom()) => all(doc, "ol.cases > li.case");
const rows = (doc: Doc = dom()) => all(doc, "table.matrix tbody tr");
const order = (doc: Doc) => cards(doc).map((li) => one(li, "h3 a").getAttribute("href"));
const cardOf = (doc: Doc, id: string) => nth(cards(doc), order(doc).indexOf(href(id)) + 1);
const only = (d: Incident, selector: string) => text(one(nth(cards(dom([d])), 1), selector));

describe("gallery: head", () => {
  it("S002 NFR-1: starts with <!doctype html>", () => {
    expect(page().startsWith("<!doctype html>")).toBe(true);
  });

  it("S002 NFR-1: sets lang en on html", () => {
    expect(dom().documentElement.getAttribute("lang")).toBe("en");
  });

  it("S002 NFR-1: head starts with charset, CSP, referrer and DNS prefetch metas", () => {
    const first = [...dom().head.children].slice(0, 4);
    expect(first.map((el) => el.localName)).toEqual(["meta", "meta", "meta", "meta"]);
    expect(first.map(attrs)).toEqual([
      { charset: "utf-8" },
      { "http-equiv": "Content-Security-Policy", content: expect.any(String) },
      { name: "referrer", content: "no-referrer" },
      { "http-equiv": "x-dns-prefetch-control", content: "off" },
    ]);
  });

  it("S002 NFR-1: CSP allows only the page's own style by hash", () => {
    const out = page();
    const styles = inner(out, "style");
    expect(styles).toHaveLength(1);
    expect(
      one(parse(out), 'meta[http-equiv="Content-Security-Policy"]').getAttribute("content"),
    ).toBe(
      `default-src 'none'; style-src 'sha256-${sha(styles[0] ?? "")}'; base-uri 'none'; form-action 'none'`,
    );
  });

  it("S002 NFR-1: has no script element", () => {
    expect(page()).not.toMatch(/<script/i);
  });
});

describe("gallery: card order", () => {
  it("S002 FR-1: one card per incident file, newest first", () => {
    expect(order(dom())).toEqual(SORTED.map((d) => href(d.id)));
  });

  it.each([
    ["reversed", [...GALLERY].reverse()],
    ["rotated", [...GALLERY.slice(2), ...GALLERY.slice(0, 2)]],
  ])("S002 FR-1, NFR-2: a %s input gives the same page", (_, input) => {
    expect(page(input)).toBe(page());
  });

  it("S002 FR-1: does not reorder the input array", () => {
    const input = [...GALLERY];
    page(input);
    expect(input.map((d) => d.id)).toEqual(GALLERY.map((d) => d.id));
  });

  it.each<[string, Incident["dates"], string[]]>([
    [
      "disclosed first",
      { started: "2026-01", discovered: "2026-01", disclosed: "2020-01" },
      ["case-b", "case-a"],
    ],
    [
      "discovered before started",
      { started: "2026-01", discovered: "2020-01", disclosed: null },
      ["case-b", "case-a"],
    ],
    [
      "started when the others are null",
      { started: "2026-01", discovered: null, disclosed: null },
      ["case-a", "case-b"],
    ],
  ])("S002 FR-1: sorts by %s", (_, dates, want) => {
    expect(order(dom([dated("case-b", OLD), dated("case-a", dates)]))).toEqual(want.map(href));
  });

  it("S002 FR-1: incidents with no dates go last, by id", () => {
    const input = [dated("case-c", NO_DATES), dated("case-a", NO_DATES), dated("case-b", OLD)];
    expect(order(dom(input))).toEqual(["case-b", "case-a", "case-c"].map(href));
  });

  it("S002 FR-1: incidents with the same date sort by id", () => {
    const older = { ...OLD, disclosed: "2020-01" };
    const input = [dated("case-c", OLD), dated("case-a", older), dated("case-b", OLD)];
    expect(order(dom(input))).toEqual(["case-b", "case-c", "case-a"].map(href));
  });

  it("S002 FR-1: an empty gallery has no cards or rows", () => {
    const doc = dom([]);
    expect([cards(doc).length, rows(doc).length]).toEqual([0, 0]);
    expect(text(one(doc, ".totals"))).toMatch(word("0 incidents"));
  });
});

describe("gallery: cards", () => {
  it("S002 FR-1, FR-2: each card title links to its map with the full title", () => {
    expect(cards().map((li) => link(one(li, "h3 a")))).toEqual(
      SORTED.map((d) => ({ href: href(d.id), text: d.title })),
    );
  });

  it.each(CASES)("S002 FR-1: card $n ($id) meta shows its number and year $year", ({ n, year }) => {
    const meta = text(one(nth(cards(), n), ".case-meta"));
    expect(meta).toContain(`Case ${String(n).padStart(2, "0")}`);
    expect(meta).toMatch(word(year));
  });

  it.each(CASES)("S002 FR-1: card $n ($id) meta shows exactly its CVEs", ({ n, cve }) => {
    expect(cves(text(one(nth(cards(), n), ".case-meta")))).toEqual(cve);
  });

  it("S002 FR-1: meta shows no CVE without identifiers", () => {
    const d = variant((copy) => {
      delete copy.identifiers;
    });
    expect(only(d, ".case-meta")).not.toContain("CVE");
  });

  it("S002 FR-1: meta shows every CVE in order", () => {
    const d = variant((copy) => {
      copy.identifiers = { cve: ["CVE-2099-0001", "CVE-2099-12345"] };
    });
    expect(cves(only(d, ".case-meta"))).toEqual(["CVE-2099-0001", "CVE-2099-12345"]);
  });

  it("S002 FR-1: meta shows Unknown as the year when all dates are null", () => {
    expect(only(dated("case-a", NO_DATES), ".case-meta")).toContain("Unknown");
  });

  it.each(CASES)("S002 FR-1: card $n ($id) counts steps, sources and defenses", ({ n, d }) => {
    const counts = text(one(nth(cards(), n), ".counts"));
    expect(counts).toMatch(word(plural(d.steps.length, "step")));
    expect(counts).toMatch(word(plural(d.sources.length, "source")));
    expect(counts).toMatch(word(plural(d.defenses.length, "defense")));
  });

  it("S002 FR-1: a count of one is singular", () => {
    const d = variant((copy) => {
      copy.defenses = copy.defenses.slice(0, 1);
    });
    expect(only(d, ".counts")).toMatch(word("1 defense"));
  });

  it.each(CASES)("S002 FR-1: card $n ($id) says $review", ({ n, review }) => {
    expect(text(one(nth(cards(), n), ".counts"))).toContain(review);
  });

  it("S002 FR-1: a reviewed card names its reviewer", () => {
    const counts = only(
      variant((d) => {
        d.provenance.reviewedBy = "Ann";
      }),
      ".counts",
    );
    expect([counts.includes("Reviewed by Ann"), counts.includes("Not reviewed yet")]).toEqual([
      true,
      false,
    ]);
  });

  it("S002 FR-1: an unreviewed card says Not reviewed yet", () => {
    const counts = only(
      variant((d) => {
        delete d.provenance.reviewedBy;
      }),
      ".counts",
    );
    expect([counts.includes("Not reviewed yet"), counts.includes("Reviewed by")]).toEqual([
      true,
      false,
    ]);
  });
});

describe("gallery: step strip", () => {
  it.each(CASES)(
    "S002 FR-1: card $n ($id) strip has one span per step with its confidence",
    ({ n, d }) => {
      expect(all(nth(cards(), n), ".strip > span").map(confidenceOf)).toEqual(confidences(d));
    },
  );

  it.each(CASES)("S002 FR-1: card $n ($id) strip text reads $strip", ({ n, strip }) => {
    expect(text(one(nth(cards(), n), ".strip-text"))).toBe(strip);
  });

  it.each<[string, Confidence[], string]>([
    [
      "lists confirmed, reported, then disputed",
      ["disputed", "reported", "confirmed"],
      "1 confirmed · 1 reported · 1 disputed",
    ],
    ["counts each kind", ["confirmed", "disputed", "confirmed"], "2 confirmed · 1 disputed"],
    ["leaves out kinds with no steps", ["reported", "reported", "reported"], "3 reported"],
  ])("S002 FR-1: strip text %s", (_, kinds, want) => {
    const d = variant((copy) => {
      copy.steps.forEach((s, i) => {
        s.confidence = kinds[i] ?? "confirmed";
      });
    });
    expect(only(d, ".strip-text")).toBe(want);
  });
});

describe("gallery: mini diagram", () => {
  it.each(CASES)("S002 FR-1: card $n ($id) has one svg.mini with aria-hidden", ({ n }) => {
    expect(all(nth(cards(), n), "svg.mini").map((svg) => svg.getAttribute("aria-hidden"))).toEqual([
      "true",
    ]);
  });

  it.each(CASES)(
    "S002 FR-1: card $n ($id) mini diagram has one .lane per layout lane",
    ({ n, d }) => {
      expect(all(one(nth(cards(), n), "svg.mini"), ".lane")).toHaveLength(layout(d).lanes.length);
    },
  );

  it.each(CASES)(
    "S002 FR-1: card $n ($id) mini diagram has one .s per step with its confidence",
    ({ n, d }) => {
      expect(all(one(nth(cards(), n), "svg.mini"), ".s").map(confidenceOf)).toEqual(confidences(d));
    },
  );
});

describe("gallery: matrix", () => {
  const cell = (td: El) => [text(td), td.className];

  it("S002 FR-1: columns are the 15 tactics in order", () => {
    expect(texts(dom(), "table.matrix thead th[scope=col]")).toEqual(
      Object.values(TACTICS).map((t) => t.name),
    );
  });

  it("S002 FR-1, FR-2: one row per card, linking its map by short title", () => {
    expect(rows().map((tr) => link(one(tr, "th[scope=row] a")))).toEqual(
      SORTED.map((d) => ({ href: href(d.id), text: short(d.title) })),
    );
  });

  it.each([
    ["Alpha: beta (gamma)", "Alpha"],
    ["Alpha (beta): gamma", "Alpha"],
    ["Alpha beta", "Alpha beta"],
    ["Alpha:beta(gamma)", "Alpha:beta(gamma)"],
    [": Alpha", ": Alpha"],
  ])("S002 FR-1: the row link for the title %j reads %j", (title, want) => {
    const doc = dom([check({ ...structuredClone(VALID), title })]);
    expect(text(one(doc, "table.matrix tbody th[scope=row] a"))).toBe(want);
  });

  it.each(CASES)("S002 FR-1: row $n ($id) counts steps per tactic", ({ n, d }) => {
    const counts = Object.keys(TACTICS).map((k) => d.steps.filter((s) => s.phase === k).length);
    expect(all(nth(rows(), n), "td").map(cell)).toEqual(
      counts.map((c) => (c ? [String(c), `c${Math.min(c, 3)}`] : ["", ""])),
    );
  });

  it.each<[number, string]>([
    [1, "c1"],
    [2, "c2"],
    [3, "c3"],
    [4, "c3"],
  ])("S002 FR-1: %i steps in a tactic show the number with class %s", (n, cls) => {
    const d = variant((copy) => {
      copy.steps = [...copy.steps, ...copy.steps.slice(0, 1).map((s) => ({ ...s, id: "extra" }))];
      copy.steps.forEach((s, i) => {
        if (i < n) s.phase = "execution";
      });
    });
    const tds = all(nth(rows(dom([d])), 1), "td");
    expect(cell(nth(tds, Object.keys(TACTICS).indexOf("execution") + 1))).toEqual([String(n), cls]);
  });
});

describe("gallery: totals, evals, make your own, footer", () => {
  it("S002 FR-1: totals count incidents, steps, sources and defenses", () => {
    const totals = text(one(dom(), ".totals"));
    const sum = (f: (d: Incident) => number) => GALLERY.reduce((n, d) => n + f(d), 0);
    for (const phrase of [
      plural(GALLERY.length, "incident"),
      plural(
        sum((d) => d.steps.length),
        "step",
      ),
      plural(
        sum((d) => d.sources.length),
        "source",
      ),
      plural(
        sum((d) => d.defenses.length),
        "defense",
      ),
    ]) {
      expect(totals).toMatch(word(phrase));
    }
  });

  it("S002 FR-3: #method counts the reviewed maps", () => {
    const reviewed = GALLERY.filter((d) => d.provenance.reviewedBy).length;
    expect(text(one(dom(), "#method"))).toContain(`${reviewed} of ${GALLERY.length} reviewed`);
  });

  it.each(["100%", "0 broken links", "81%", "2026-11-25", "0.1.0", "Provisional"])(
    "S002 FR-3: #evals shows %s",
    (shown) => {
      expect(text(one(dom(), "#evals"))).toContain(shown);
    },
  );

  it.each(["90%", "2 broken links", "76%", "80%"])(
    "S002 FR-3: #evals rounds scores and shows %s",
    (shown) => {
      const evals = { ...EVALS, E1: 0.9, E2: 2, E3: 0.756, E4: 0.804 };
      expect(text(one(dom(GALLERY, { ...META, evals }), "#evals"))).toMatch(word(shown));
    },
  );

  it("S002 FR-3: final scores are not called provisional", () => {
    const evals = { ...EVALS, provisional: false };
    expect(text(one(dom(GALLERY, { ...META, evals }), "#evals"))).not.toMatch(/provisional/i);
  });

  it("S002 FR-3: no #evals without eval results", () => {
    expect(dom(GALLERY, { version: "0.1.0" }).querySelector("#evals")).toBeNull();
  });

  it("S002 FR-4: #make shows the render command", () => {
    expect(text(one(dom(), "#make"))).toContain("pnpm breachmap render");
  });

  it("S002: footer shows the Breachmap version", () => {
    expect(text(one(dom(GALLERY, { ...META, version: "9.8.7" }), "footer"))).toContain(
      "Breachmap 9.8.7",
    );
  });
});

describe("gallery: hostile text", () => {
  const doc = () => dom([...GALLERY, XSS]);

  it.each(["script", "img", "iframe"])("S002 NFR-1: creates no %s element", (tag) => {
    expect(all(doc(), tag)).toEqual([]);
  });

  it("S002 NFR-1: no element has an event handler attribute", () => {
    const names = all(doc(), "*").flatMap((el) => el.getAttributeNames());
    expect(names.filter((name) => name.startsWith("on"))).toEqual([]);
  });

  it("S002 NFR-1: the hostile title is text in the card link and the row link", () => {
    const d = doc();
    const a = `a[href="${href(XSS.id)}"]`;
    expect([
      text(one(d, `li.case h3 ${a}`)),
      text(one(d, `table.matrix th[scope=row] ${a}`)),
    ]).toEqual([XSS.title, short(XSS.title)]);
  });

  it("S002 NFR-1: the hostile reviewer is text", () => {
    expect(text(one(cardOf(doc(), XSS.id), ".counts"))).toContain("Reviewed by <b>Reviewer</b>");
  });
});

describe("gallery: no network, no hidden content", () => {
  it.each(["src=", "<link", "@import", "url("])("S002 NFR-1: the page has no %s", (bad) => {
    expect(page().toLowerCase()).not.toContain(bad);
  });

  it("S002 NFR-1: every href is https, a #anchor or a maps/ link", () => {
    const hrefs = all(dom([...GALLERY, XSS]), "[href]").map((el) => el.getAttribute("href") ?? "");
    expect(hrefs.filter((h) => !/^(https:\/\/|#|maps\/)/.test(h))).toEqual([]);
  });

  it.each(["hidden", "style"])("S002 NFR-1: no element has a %s attribute", (name) => {
    expect(all(dom(), `[${name}]`)).toEqual([]);
  });

  it("S002 NFR-2: the same input renders the same string twice", () => {
    expect(page(structuredClone(GALLERY))).toBe(page());
  });
});
