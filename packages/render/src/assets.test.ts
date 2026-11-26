import { describe, expect, it } from "vitest";
import { CSS } from "./assets.ts";
import { GALLERY_CSS } from "./gallery.ts";

const css = CSS.html;
const motion = "@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}";

const palette = (block: string) =>
  Object.fromEntries(
    [...block.matchAll(/--([a-z0-9-]+):(#[0-9a-f]{6})/g)].map(([, k, v]) => [k, v]),
  );

const palettes = (sheet: string) => {
  const dark = sheet.slice(sheet.indexOf("@media (prefers-color-scheme:dark)"));
  return [
    ["light", palette(sheet.slice(0, sheet.indexOf("}")))],
    ["dark", palette(dark.slice(0, dark.indexOf("}}")))],
  ] as const;
};

const luminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

const MAP = {
  name: "map",
  css,
  pairs: [
    ["fg", "bg"],
    ["fg", "card"],
    ["fg", "accent-bg"],
    ["muted", "bg"],
    ["muted", "card"],
    ["muted", "accent-bg"],
    ["accent", "bg"],
    ["accent", "card"],
    ["accent", "accent-bg"],
    ["reported", "card"],
    ["disputed", "card"],
    ["bg", "accent"],
  ],
};

const GALLERY = {
  name: "gallery",
  css: GALLERY_CSS.html,
  pairs: [
    ["fg", "bg"],
    ["fg", "card"],
    ["muted", "bg"],
    ["muted", "card"],
    ["accent", "bg"],
    ["accent", "card"],
    ["bg", "fg"],
    ["bg", "accent"],
    ["fg", "c1"],
    ["fg", "c2"],
    ["reported", "card"],
    ["disputed", "card"],
  ],
};

// Gives each sheet the spec id of the rule it checks.
const sheets = (map: string, gallery: string) => [
  { id: map, ...MAP },
  { id: `S002 ${gallery}`.trim(), ...GALLERY },
];

const modes = (map: string, gallery: string) =>
  sheets(map, gallery).flatMap((s) =>
    palettes(s.css).map(([mode, colors]) => ({ ...s, mode, colors })),
  );

describe("CSS and GALLERY_CSS", () => {
  it.each(modes("NFR-6", "NFR-1"))(
    "$id: the $name $mode palette meets WCAG AA contrast",
    ({ pairs, colors }) => {
      for (const [fg = "", bg = ""] of pairs) {
        expect(contrast(colors[fg], colors[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(colors.line, colors.bg), "line on bg").toBeGreaterThanOrEqual(3);
      expect(contrast(colors.line, colors.card), "line on card").toBeGreaterThanOrEqual(3);
    },
  );

  it.each(sheets("NFR-6", "NFR-1"))("$id: the $name CSS shows a visible focus outline", (s) => {
    expect(s.css).toContain(":focus-visible{outline:3px solid var(--accent)");
  });

  it.each(sheets("NFR-6", "NFR-1"))(
    "$id: the $name CSS scrolls smoothly only when motion is not reduced, with no animations",
    (s) => {
      expect(s.css).toContain(motion);
      expect(s.css.replace(motion, "")).not.toContain("scroll-behavior");
      expect(s.css).not.toMatch(/animation|transition/);
    },
  );

  it.each(sheets("NFR-1", "NFR-1"))("$id: the $name CSS loads nothing from the network", (s) => {
    expect(s.css).not.toMatch(/url\(|@import|@font-face|http/i);
  });

  it.each(sheets("NFR-4", ""))("$id: the $name CSS stays small", (s) => {
    expect(s.css.length).toBeLessThan(8000);
  });
});

describe("CSS", () => {
  it("NFR-5: on small screens the diagram scrolls sideways; two columns only from 60rem", () => {
    expect(css).toContain(".diagram{margin:0;overflow:auto");
    expect(css).toContain("@media (min-width:60rem){#flow{grid-template-columns");
  });

  it("NFR-5: long words such as hashes wrap instead of widening the page", () => {
    expect(css).toContain("overflow-wrap:anywhere");
  });

  it("NFR-5: on wide screens the diagram column fits the diagram and stays within the screen", () => {
    expect(css).toContain("grid-template-columns:minmax(0,max-content) minmax(22rem,1fr)");
    expect(css).toContain(".diagram{position:sticky;top:1rem;max-height:calc(100vh - 2rem)}");
  });

  it("FR-11: step controls show only when the script has run", () => {
    expect(css).toContain(".controls{display:none}");
    expect(css).toContain(".js .controls{display:flex");
  });

  it("FR-9, FR-11: :target highlights a step and a source only without JavaScript", () => {
    expect(css).toContain("html:not(.js) .step:target,");
    expect(css).toContain("html:not(.js) .sources li:target,");
  });
});
