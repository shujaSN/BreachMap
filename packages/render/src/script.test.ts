import { readFileSync } from "node:fs";
import { type Element, Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCRIPT } from "./assets.ts";
import { render } from "./index.ts";

const valid = JSON.parse(
  readFileSync(new URL("../../../fixtures/valid.json", import.meta.url), "utf8"),
);
const IDS = ["phishing-email", "build-server-login", "tampered-release"];
const SOURCES = ["src-example-advisory", "src-example-news", "src-example-vendor"];

type Opts = { hash?: string; input?: unknown; reduce?: boolean };
type Mods = { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean };

let win: Window;

afterEach(async () => {
  vi.restoreAllMocks();
  await win.happyDOM.close();
});

// Writes the page into a new window; happy-dom does not run the inline script.
function load({ hash = "", input = valid, reduce = false }: Opts = {}) {
  const result = render(input, { version: "0.1.0" });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  win = new Window({
    url: `https://map.test/${hash}`,
    settings: { device: { prefersReducedMotion: reduce ? "reduce" : "no-preference" } },
  });
  win.document.write(result.value);
  return win.document;
}

function boot(opts?: Opts) {
  const doc = load(opts);
  new Function("window", "document", SCRIPT.html)(win, doc);
  return doc;
}

function $(selector: string): Element {
  const el = win.document.querySelector(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

const click = (selector: string) =>
  $(selector).dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));

// Sends keydown and returns whether the default was prevented.
function press(key: string, mods: Mods = {}, target: Element = win.document.body) {
  const event = new win.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...mods });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

const pick = (selector: string, attr: string) =>
  [...win.document.querySelectorAll(selector)].map((el) => el.getAttribute(attr));

const attrs = (el: Element) =>
  Object.fromEntries(el.getAttributeNames().map((n) => [n, el.getAttribute(n)]));

const state = () => ({
  steps: pick('li[aria-current="step"]', "id"),
  arrows: pick('a.arrow[aria-current="step"]', "data-step"),
  sources: pick("ol.sources > li.hl", "id"),
  status: $("#nav-status").textContent,
  prev: $("#nav-prev").hasAttribute("disabled"),
  next: $("#nav-next").hasAttribute("disabled"),
});

// Expected state when step i (0-based) of valid.json is selected.
const at = (i: number) => ({
  steps: [`step-${IDS[i]}`],
  arrows: [`step-${IDS[i]}`],
  sources: [SOURCES[i]],
  status: `Step ${i + 1} of 3`,
  prev: i === 0,
  next: i === 2,
});

// Target step id, start hash, expected index.
const JUMPS: [string, string, number][] = [
  ["phishing-email", "#step-tampered-release", 0],
  ["build-server-login", "", 1],
  ["tampered-release", "", 2],
];

describe("script: without JavaScript", () => {
  it("FR-11: flow has the heading, the controls, the diagram, then the steps", () => {
    load();
    expect([...$("section#flow").children].map((el) => `${el.localName}.${el.className}`)).toEqual([
      "h2.",
      "div.controls",
      "figure.diagram",
      "ol.steps",
    ]);
  });

  it("FR-11: controls are a labelled group of two buttons and a live status", () => {
    load();
    const controls = $(".controls");
    expect([
      attrs(controls),
      [...controls.children].map((el) => [el.localName, attrs(el), el.textContent]),
    ]).toEqual([
      { class: "controls", role: "group", "aria-label": "Step navigation" },
      [
        [
          "button",
          { type: "button", id: "nav-prev", "aria-keyshortcuts": "ArrowLeft" },
          "Previous step",
        ],
        ["span", { id: "nav-status", "aria-live": "polite" }, ""],
        [
          "button",
          { type: "button", id: "nav-next", "aria-keyshortcuts": "ArrowRight" },
          "Next step",
        ],
        ["span", { class: "hint" }, "or use ← →"],
      ],
    ]);
  });

  it("FR-11: html has no js class and nothing is selected", () => {
    const doc = load();
    expect([
      doc.documentElement.classList.contains("js"),
      doc.querySelectorAll("[aria-current], .hl").length,
    ]).toEqual([false, 0]);
  });
});

describe("script: start", () => {
  it("FR-11: adds the js class to html", () => {
    expect(boot().documentElement.classList.contains("js")).toBe(true);
  });

  it("FR-9: selects step 1", () => {
    boot();
    expect(state()).toEqual(at(0));
  });

  it.each(IDS.map((id, i): [string, number] => [`#step-${id}`, i]))(
    "FR-9: hash %s selects that step",
    (hash, i) => {
      boot({ hash });
      expect(state()).toEqual(at(i));
    },
  );

  it.each(["#", "#nope", "#step-", "#src-example-news", "#def-verify-builds", "#flow", "#a]b"])(
    "FR-9: hash %s selects step 1",
    (hash) => {
      boot({ hash });
      expect(state()).toEqual(at(0));
    },
  );

  it.each(["", "#step-tampered-release"])("NFR-6: does not move focus with hash '%s'", (hash) => {
    const doc = boot({ hash });
    expect(doc.activeElement).toBe(doc.body);
  });

  it("NFR-6: every step gets tabindex -1", () => {
    boot();
    expect(pick("li.step", "tabindex")).toEqual(["-1", "-1", "-1"]);
  });

  it("FR-9: highlights every source of a step with several sources", () => {
    const input = structuredClone(valid);
    input.steps[0].sourceIds = ["example-advisory", "example-news"];
    boot({ input });
    expect(pick("ol.sources > li.hl", "id")).toEqual(["src-example-advisory", "src-example-news"]);
  });

  it("FR-9: a one-step incident shows Step 1 of 1 with both buttons disabled", () => {
    const input = structuredClone(valid);
    input.steps = [{ ...input.steps[0], sourceIds: ["example-advisory", "example-news"] }];
    input.defenses[0].stepIds = ["phishing-email"];
    input.defenses[1].stepIds = [];
    boot({ input });
    expect(state()).toEqual({
      steps: ["step-phishing-email"],
      arrows: ["step-phishing-email"],
      sources: ["src-example-advisory", "src-example-news"],
      status: "Step 1 of 1",
      prev: true,
      next: true,
    });
  });
});

describe("script: buttons", () => {
  // Clicks the button three times and returns the state after each click.
  const thrice = (button: string) =>
    [1, 2, 3].map(() => {
      click(button);
      return state();
    });

  it("FR-9: Next step moves one step at a time and stops at the last", () => {
    boot();
    expect(thrice("#nav-next")).toEqual([at(1), at(2), at(2)]);
  });

  it("FR-9: Previous step moves back one step at a time and stops at the first", () => {
    boot({ hash: "#step-tampered-release" });
    expect(thrice("#nav-prev")).toEqual([at(1), at(0), at(0)]);
  });

  it.each([
    ["#nav-next", ""],
    ["#nav-prev", "#step-build-server-login"],
  ])("NFR-6: %s keeps focus so it can be pressed again", (button, hash) => {
    const doc = boot({ hash });
    ($(button) as unknown as { focus: () => void }).focus();
    click(button);
    expect(`#${doc.activeElement?.id}`).toBe(button);
  });
});

describe("script: keys", () => {
  it.each([
    ["ArrowRight", "", 1],
    ["ArrowLeft", "#step-build-server-login", 0],
  ])("FR-9, NFR-6: %s moves one step and prevents the default", (key, hash, i) => {
    boot({ hash });
    expect([press(key), state()]).toEqual([true, at(i)]);
  });

  it.each([
    ["ArrowRight", "#step-tampered-release", 2],
    ["ArrowLeft", "", 0],
  ])("FR-9: %s stops at the end", (key, hash, i) => {
    boot({ hash });
    press(key);
    expect(state()).toEqual(at(i));
  });

  it("NFR-6: an arrow key moves focus to the selected step", () => {
    const doc = boot();
    press("ArrowRight");
    expect(doc.activeElement?.id).toBe("step-build-server-login");
  });

  it("NFR-6: arrow keys inside the scrollable diagram are left to the browser", () => {
    boot({ hash: "#step-build-server-login" });
    expect([press("ArrowRight", {}, $(".diagram")), state()]).toEqual([false, at(1)]);
  });

  it.each(["ArrowUp", "ArrowDown", "Enter", " ", "Home", "End", "Tab", "a"])(
    "FR-9: key '%s' does nothing",
    (key) => {
      boot({ hash: "#step-build-server-login" });
      expect([press(key), state()]).toEqual([false, at(1)]);
    },
  );

  it.each(
    ["altKey", "ctrlKey", "metaKey"].flatMap((mod) =>
      ["ArrowLeft", "ArrowRight"].map((key) => [key, mod]),
    ),
  )("FR-9: %s with %s is ignored", (key, mod) => {
    boot({ hash: "#step-build-server-login" });
    expect([press(key, { [mod]: true }), state()]).toEqual([false, at(1)]);
  });

  it.each(
    ["input", "textarea", "select"].flatMap((tag) =>
      ["ArrowLeft", "ArrowRight"].map((key) => [key, tag]),
    ),
  )("FR-9, NFR-6: %s in a %s is ignored", (key, tag) => {
    const doc = boot({ hash: "#step-build-server-login" });
    const field = doc.createElement(tag);
    doc.body.append(field);
    expect([press(key, {}, field), state()]).toEqual([false, at(1)]);
  });

  it("FR-9, NFR-6: ArrowRight in a defense checkbox is ignored", () => {
    boot({ hash: "#step-build-server-login" });
    expect([press("ArrowRight", {}, $("#defenses input[type=checkbox]")), state()]).toEqual([
      false,
      at(1),
    ]);
  });
});

describe("script: clicks", () => {
  it.each(JUMPS)("FR-9: clicking the diagram arrow of %s selects it", (id, hash, i) => {
    boot({ hash });
    click(`a.arrow[data-step="step-${id}"] > :is(line, circle)`);
    expect(state()).toEqual(at(i));
  });

  it.each(JUMPS)("FR-9: clicking a defense link to %s selects it", (id, hash, i) => {
    boot({ hash });
    click(`#defenses a[href="#step-${id}"]`);
    expect(state()).toEqual(at(i));
  });

  it.each(JUMPS)("FR-9: clicking a source link in step %s selects that step", (id, hash, i) => {
    boot({ hash });
    click(`#step-${id} .cites a`);
    expect(state()).toEqual(at(i));
  });

  it.each(JUMPS)("FR-9: clicking the text of step %s selects it", (id, hash, i) => {
    boot({ hash });
    click(`#step-${id} > p:not([class])`);
    expect(state()).toEqual(at(i));
  });
});

describe("script: reduced motion", () => {
  it("NFR-6: with reduced motion the script starts and Next step works", () => {
    boot({ reduce: true });
    click("#nav-next");
    expect(state()).toEqual(at(1));
  });

  it("NFR-6: scrolls with block nearest and leaves smoothness to the CSS reduced-motion rule", () => {
    boot();
    const scroll = vi.spyOn(win.HTMLElement.prototype, "scrollIntoView");
    click("#nav-next");
    press("ArrowRight");
    expect(scroll.mock.calls).toEqual([[{ block: "nearest" }], [{ block: "nearest" }]]);
  });
});

describe("script: source", () => {
  it.each([
    "innerHTML",
    "outerHTML",
    "insertAdjacentHTML",
    "document.write",
    "eval(",
    "new Function",
    "setTimeout",
    "setInterval",
    "fetch",
    "XMLHttpRequest",
    "import(",
    "</script",
    "<!--",
    "`",
    "\\",
  ])("NFR-1: does not contain %s", (token) => {
    expect(SCRIPT.html.toLowerCase()).not.toContain(token.toLowerCase());
  });
});
