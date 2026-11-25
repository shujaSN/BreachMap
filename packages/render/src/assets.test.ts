import { describe, expect, it } from "vitest";
import { CSS } from "./assets.ts";

const css = CSS.html;
const dark = css.slice(css.indexOf("@media (prefers-color-scheme:dark)"));

const palette = (block: string) =>
  Object.fromEntries([...block.matchAll(/--([a-z-]+):(#[0-9a-f]{6})/g)].map(([, k, v]) => [k, v]));

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

const TEXT_PAIRS = [
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
];

describe("CSS", () => {
  it.each([
    ["light", palette(css.slice(0, css.indexOf("}")))],
    ["dark", palette(dark.slice(0, dark.indexOf("}}")))],
  ])("NFR-6: the %s palette meets WCAG AA contrast", (_, colors) => {
    for (const [fg = "", bg = ""] of TEXT_PAIRS) {
      expect(contrast(colors[fg], colors[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(colors.line, colors.bg), "line on bg").toBeGreaterThanOrEqual(3);
    expect(contrast(colors.line, colors.card), "line on card").toBeGreaterThanOrEqual(3);
  });

  it("NFR-6: shows a visible focus outline", () => {
    expect(css).toContain(":focus-visible{outline:3px solid var(--accent)");
  });

  it("NFR-6: scrolls smoothly only when motion is not reduced, with no animations", () => {
    expect(css).toContain(
      "@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}",
    );
    expect(css).not.toMatch(/animation|transition/);
  });

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

  it("FR-9, FR-11: :target highlights a step and a source without JavaScript", () => {
    expect(css).toContain(".step:target");
    expect(css).toContain(".sources li:target");
  });

  it("NFR-1: loads nothing from the network", () => {
    expect(css).not.toMatch(/url\(|@import|@font-face|https?:/i);
  });

  it("NFR-4: stays small", () => {
    expect(css.length).toBeLessThan(8000);
  });
});
