import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import { type Html, html, isHtml } from "./index.ts";

const text = (v: unknown) => html`<p>${v}</p>`.html;
const attr = (v: unknown) => html`<a title="${v}">x</a>`.html;

const CHARS: [string, string][] = [
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
];

const MIXED: [string, string][] = [
  [`a<b>&"c'd`, "a&lt;b&gt;&amp;&quot;c&#39;d"],
  ["<<>>&&", "&lt;&lt;&gt;&gt;&amp;&amp;"],
  ["&amp;", "&amp;amp;"],
  ["&lt;b&gt;", "&amp;lt;b&amp;gt;"],
  ["plain café ✓ 123", "plain café ✓ 123"],
];

const AC3: [string, string][] = [
  ["<script>alert(1)</script>", "&lt;script&gt;alert(1)&lt;/script&gt;"],
  ["<img src=x onerror=alert(1)>", "&lt;img src=x onerror=alert(1)&gt;"],
  ['"><svg onload=alert(1)>', "&quot;&gt;&lt;svg onload=alert(1)&gt;"],
  ["</title>", "&lt;/title&gt;"],
  ["</style>", "&lt;/style&gt;"],
];

const FORGED: [string, unknown][] = [
  ["a plain look-alike", { html: "<b>x</b>" }],
  ["a frozen look-alike", Object.freeze({ html: "<script>" })],
  ["a copy of real html", { ...html`<b>x</b>` }],
];

describe("html", () => {
  it("FR-3: returns an object with the html string", () => {
    expect(html`<p>hi</p>`).toEqual({ html: "<p>hi</p>" });
  });

  it("FR-3: returns the Html type", () => {
    expectTypeOf(html`<p>hi</p>`).toEqualTypeOf<Html>();
  });

  it("NFR-1: outputs static parts as-is", () => {
    expect(html`<p class="a">a & b 'c'</p>`.html).toBe(`<p class="a">a & b 'c'</p>`);
  });

  it("NFR-1: uses cooked static strings", () => {
    expect(html`a\nbé`.html).toBe("a\nbé");
  });

  it("NFR-1: an empty template is empty", () => {
    expect(html``.html).toBe("");
  });

  it.each(CHARS)("NFR-1: escapes %s in text", (v, out) => {
    expect(text(v)).toBe(`<p>${out}</p>`);
  });

  it.each(CHARS)("NFR-1: escapes %s in a quoted attribute", (v, out) => {
    expect(attr(v)).toBe(`<a title="${out}">x</a>`);
  });

  it.each(MIXED)("NFR-1: escapes %s as %s", (v, out) => {
    expect(text(v)).toBe(`<p>${out}</p>`);
  });

  it.each(MIXED)("NFR-1: escapes %s in a quoted attribute", (v, out) => {
    expect(attr(v)).toBe(`<a title="${out}">x</a>`);
  });

  it.each(AC3)("NFR-1: AC3 renders %s as text", (v, out) => {
    expect(text(v)).toBe(`<p>${out}</p>`);
  });

  it.each(AC3)("NFR-1: AC3 %s cannot leave a quoted attribute", (v, out) => {
    expect(attr(v)).toBe(`<a title="${out}">x</a>`);
  });

  it.each(AC3)("NFR-1: AC3 %s leaves no raw markup characters", (v) => {
    expect(html`${v}`.html).not.toMatch(/[<>"']/);
  });

  it("NFR-1: escapes each of several values", () => {
    expect(html`<a title="${'"x"'}">${"<y>"}</a>`.html).toBe(
      `<a title="&quot;x&quot;">&lt;y&gt;</a>`,
    );
  });

  it("NFR-1: inserts nested html as-is", () => {
    expect(text(html`<b>x</b>`)).toBe("<p><b>x</b></p>");
  });

  it("NFR-1: does not escape nested values twice", () => {
    expect(html`<ul>${html`<li>${"a&b"}</li>`}</ul>`.html).toBe("<ul><li>a&amp;b</li></ul>");
  });

  it("NFR-1: joins arrays of html and strings", () => {
    expect(text([html`<i>a</i>`, "<b>", html`<i>c</i>`])).toBe("<p><i>a</i>&lt;b&gt;<i>c</i></p>");
  });

  it("NFR-1: joins mapped html items", () => {
    expect(text(["x", "<y>"].map((s) => html`<li>${s}</li>`))).toBe(
      "<p><li>x</li><li>&lt;y&gt;</li></p>",
    );
  });

  it("NFR-1: flattens nested arrays", () => {
    expect(text(["a", ["<", [html`<br>`, ["b"]]]])).toBe("<p>a&lt;<br>b</p>");
  });

  it("NFR-1: an empty array renders nothing", () => {
    expect(text([])).toBe("<p></p>");
  });

  it("NFR-1: skips null, undefined and false in arrays", () => {
    expect(text(["a", null, undefined, false, "b"])).toBe("<p>ab</p>");
  });

  it.each([
    ["an empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["false", false],
  ])("NFR-1: %s renders nothing", (_, v) => {
    expect(text(v)).toBe("<p></p>");
  });

  it.each([true, false])("FR-3: cond && html works when cond is %s", (on) => {
    expect(text(on && html`<b>x</b>`)).toBe(on ? "<p><b>x</b></p>" : "<p></p>");
  });

  it.each([
    [0, "0"],
    [42, "42"],
    [-1.5, "-1.5"],
    [true, "true"],
  ])("NFR-1: renders %s as %s", (v, out) => {
    expect(text(v)).toBe(`<p>${out}</p>`);
  });

  it("NFR-1: escapes the String() of other objects", () => {
    expect(text({ toString: () => "<b>" })).toBe("<p>&lt;b&gt;</p>");
  });

  it.each(FORGED)("NFR-1: escapes %s", (_, v) => {
    expect(text(v)).toBe("<p>[object Object]</p>");
  });

  it("NFR-1: escapes look-alikes inside arrays", () => {
    expect(text([html`<i>a</i>`, { html: "<b>" }])).toBe("<p><i>a</i>[object Object]</p>");
  });

  it("NFR-1: returns a frozen object", () => {
    expect(Object.isFrozen(html`x`)).toBe(true);
  });

  it("NFR-1: html cannot be changed after it is made", () => {
    const h = html`<b>x</b>`;
    expect(() => {
      (h as { html: string }).html = "<script>";
    }).toThrow(TypeError);
    expect(h.html).toBe("<b>x</b>");
  });

  it("NFR-1: html.ts exports only html and isHtml", async () => {
    expect(Object.keys(await import("./html.ts")).sort()).toEqual(["html", "isHtml"]);
  });
});

describe("isHtml", () => {
  it.each([
    ["an empty template", html``],
    ["a template with values", html`<b>${"<"}</b>`],
    ["nested html", html`${html`x`}`],
  ])("NFR-1: is true for %s", (_, v) => {
    expect(isHtml(v)).toBe(true);
  });

  it.each([
    ["a string", "<b>x</b>"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 0],
    ["an array of html", [html`x`]],
    ...FORGED,
  ])("NFR-1: is false for %s", (_, v) => {
    expect(isHtml(v)).toBe(false);
  });
});

const CSS = html`a > b { color: red }`;
const JS = html`if (a < b) go();`;
const BAD = /^html: /;

class Evil extends Array<unknown> {
  override map<U>(): U[] {
    return this as unknown as U[];
  }
  override join() {
    return "<b>";
  }
}

const tsa = (s: string[]) => Object.freeze(Object.assign([...s], { raw: Object.freeze([...s]) }));

const COMMENT: [string, () => Html][] = [
  ["a string", () => html`<!-- ${"x"} -->`],
  ["html", () => html`<!--${html`<b>`}-->`],
  ["after an earlier closed comment", () => html`<!-- a --><p></p><!-- ${"x"}`],
];

const TAG: [string, () => Html][] = [
  ["tag name", () => html`<${"a"}>x</a>`],
  ["closing tag name", () => html`<a>x</${"a"}>`],
  ["attribute name", () => html`<a ${"title"}="x">x</a>`],
  ["bare attribute", () => html`<a ${"hidden"}>x</a>`],
  ["after a quoted value", () => html`<a title="x" ${"y"}>x</a>`],
  ["right after a closing quote", () => html`<a title="x"${"y"}>x</a>`],
  ["unquoted value", () => html`<a title=${"x"}>x</a>`],
  ["unquoted value after a space", () => html`<a title= ${"x"}>x</a>`],
  ["single-quoted value", () => html`<a title='${"x"}'>x</a>`],
];

const DANGER: [string, () => Html][] = [
  ['onclick="…"', () => html`<a onclick="${"x"}">x</a>`],
  ['ONCLICK="…"', () => html`<a ONCLICK="${"x"}">x</a>`],
  ['onMouseOver="…"', () => html`<a onMouseOver="${"x"}">x</a>`],
  ['onclick="go(…)"', () => html`<a onclick="go(${"1"})">x</a>`],
  ['style="…"', () => html`<a style="${"color: red"}">x</a>`],
  ['srcdoc="…"', () => html`<iframe srcdoc="${"x"}"></iframe>`],
];

const ATTR_OK: [string, () => Html, string][] = [
  [
    "a static prefix in a quoted value",
    () => html`<p class="step ${"a"}">x</p>`,
    `<p class="step a">x</p>`,
  ],
  [
    "two slots in one quoted value",
    () => html`<a title="${"a"} ${"b"}">x</a>`,
    `<a title="a b">x</a>`,
  ],
  [
    "two quoted attributes",
    () => html`<a title="${"a"}" id="${"<b>"}">x</a>`,
    `<a title="a" id="&lt;b&gt;">x</a>`,
  ],
  ["a data-on attribute", () => html`<a data-on="${"x"}">x</a>`, `<a data-on="x">x</a>`],
  ["an attribute on a new line", () => html`<a\n  title="${"x"}">x</a>`, `<a\n  title="x">x</a>`],
  ["html in text after a tag", () => html`<a title="t">${html`<b>`}</a>`, `<a title="t"><b></a>`],
];

const URL_OK: [string, () => Html, string][] = [
  [
    "a #fragment prefix in href",
    () => html`<a href="#step-${"s1"}">x</a>`,
    `<a href="#step-s1">x</a>`,
  ],
  [
    "a # prefix in href with a scheme-like value",
    () => html`<a href="#${"javascript:alert(1)"}">x</a>`,
    `<a href="#javascript:alert(1)">x</a>`,
  ],
  [
    "an https href",
    () => html`<a href="${"https://example.com/?a=1&b=2"}">x</a>`,
    `<a href="https://example.com/?a=1&amp;b=2">x</a>`,
  ],
  ["a # href", () => html`<a href="${"#top"}">x</a>`, `<a href="#top">x</a>`],
];

const URL_BAD: [string, () => Html][] = [
  ["javascript: in href", () => html`<a href="${"javascript:alert(1)"}">x</a>`],
  ["JavaScript: in href", () => html`<a href="${"JavaScript:alert(1)"}">x</a>`],
  ["javascript: after a space in href", () => html`<a href="${" javascript:alert(1)"}">x</a>`],
  ["http: in href", () => html`<a href="${"http://example.com"}">x</a>`],
  ["data: in href", () => html`<a href="${"data:text/html,x"}">x</a>`],
  ["a protocol-relative href", () => html`<a href="${"//example.com"}">x</a>`],
  ["a relative href", () => html`<a href="${"a.html"}">x</a>`],
  ["an href static prefix not starting with #", () => html`<a href="x${"y"}">x</a>`],
  ["an href static https prefix", () => html`<a href="https://${"example.com"}">x</a>`],
  ["javascript: in src", () => html`<img src="${"javascript:alert(1)"}">`],
  ["javascript: in xlink:href", () => html`<use xlink:href="${"javascript:alert(1)"}"/>`],
];

const RAW_OK: [string, () => Html, string][] = [
  [
    "static css in style",
    () => html`<!doctype html><style>${CSS}</style>`,
    "<!doctype html><style>a > b { color: red }</style>",
  ],
  [
    "static js in script",
    () => html`<!doctype html><script>${JS}</script>`,
    "<!doctype html><script>if (a < b) go();</script>",
  ],
  [
    "static js in a script with attributes",
    () => html`<!doctype html><script type="module">${JS}</script>`,
    `<!doctype html><script type="module">if (a < b) go();</script>`,
  ],
  [
    "text after a closed script",
    () => html`<!doctype html><script>${JS}</script><p>${"<x>"}</p>`,
    "<!doctype html><script>if (a < b) go();</script><p>&lt;x&gt;</p>",
  ],
  [
    "text after a closed style",
    () => html`<!doctype html><style>${CSS}</style>${"<x>"}`,
    "<!doctype html><style>a > b { color: red }</style>&lt;x&gt;",
  ],
];

const RAW_BAD: [string, () => Html][] = [
  ["a string in style", () => html`<style>${"a{}"}</style>`],
  ["a number in style", () => html`<style>${1}</style>`],
  ["html with slots in style", () => html`<style>${html`a{color:${"red"}}`}</style>`],
  ["a string in script", () => html`<script>${"alert(1)"}</script>`],
  ["html with slots in script", () => html`<script>${html`go(${"1"})`}</script>`],
  ["html wrapping static html in script", () => html`<script>${html`${JS}`}</script>`],
  ["a string in a script with attributes", () => html`<script type="module">${"x"}</script>`],
  ["a string in a second script", () => html`<script>${JS}</script><script>${"x"}</script>`],
];

const NOT_TAGGED: [string, unknown, unknown[]][] = [
  ["a plain array", ["<b>x</b>"], []],
  ["a frozen array without raw", Object.freeze(["<b>x</b>"]), []],
  ["a non-array raw", Object.freeze(Object.assign(["<b>x</b>"], { raw: "<b>x</b>" })), []],
  ["a string", "<b>x</b>", []],
  ["a non-frozen array with raw", Object.assign(["<b>x</b>"], { raw: ["<b>x</b>"] }), []],
  ["too many values", tsa(["<b>", "</b>"]), ["x", "y"]],
  ["too few values", tsa(["<b>", "</b>"]), []],
];

const OVERRIDDEN: [string, unknown][] = [
  ["own join", Object.assign(["<b>"], { join: () => "<b>" })],
  ["own map", Object.assign(["<b>"], { map: () => ({ join: () => "<b>" }) })],
  ["own iterator", Object.assign(["<b>"], { [Symbol.iterator]: () => [html`<b>`].values() })],
  ["a subclass with map and join", Evil.of("<b>")],
];

describe("html contexts", () => {
  it.each(COMMENT)("NFR-1: rejects a slot in a comment: %s", (_, f) => {
    expect(f).toThrow(BAD);
  });

  it("NFR-1: rejects any comment before a slot, even a closed one", () => {
    expect(() => html`<!-- a -->${"<x>"}`).toThrow(/comments/);
  });

  it.each(TAG)("NFR-1: rejects a slot in a tag: %s", (_, f) => {
    expect(f).toThrow(BAD);
  });

  it.each(DANGER)("NFR-1: rejects any value in %s", (_, f) => {
    expect(f).toThrow(BAD);
  });

  it.each([
    ["html", html`<b>x</b>`],
    ["an empty template", html``],
    ["an array", ["a"]],
    ["an empty array", []],
  ])("NFR-1: rejects %s as an attribute value", (_, v) => {
    expect(() => attr(v)).toThrow(BAD);
  });

  it.each([
    [0, "0"],
    [42, "42"],
    [null, ""],
    [undefined, ""],
    [false, ""],
  ])("NFR-1: renders %s in an attribute as '%s'", (v, out) => {
    expect(attr(v)).toBe(`<a title="${out}">x</a>`);
  });

  it.each(ATTR_OK)("NFR-1: allows %s", (_, f, out) => {
    expect(f().html).toBe(out);
  });

  it.each(URL_OK)("NFR-1: allows %s", (_, f, out) => {
    expect(f().html).toBe(out);
  });

  it.each(URL_BAD)("NFR-1: rejects %s", (_, f) => {
    expect(f).toThrow(BAD);
  });

  it("NFR-1: checks every value at the same call site", () => {
    const link = (v: string) => html`<a href="${v}">x</a>`;
    expect(link("#a").html).toBe(`<a href="#a">x</a>`);
    expect(() => link("javascript:alert(1)")).toThrow(BAD);
  });

  it("NFR-1: a bad slot throws on every call", () => {
    const bad = () => html`<!--${"x"}-->`;
    expect(bad).toThrow(BAD);
    expect(bad).toThrow(BAD);
  });

  it.each(RAW_OK)("NFR-1: allows %s", (_, f, out) => {
    expect(f().html).toBe(out);
  });

  it.each(RAW_BAD)("NFR-1: rejects %s", (_, f) => {
    expect(f).toThrow(BAD);
  });

  it.each(NOT_TAGGED)("NFR-1: rejects %s as template strings", (_, s, v) => {
    expect(() => html(s as TemplateStringsArray, ...v)).toThrow(BAD);
  });

  it.each(OVERRIDDEN)("NFR-1: escapes an array with %s", (_, v) => {
    expect(text(v)).toBe("<p>&lt;b&gt;</p>");
  });
});

describe("render sources", () => {
  const dir = new URL(".", import.meta.url);
  const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );
  const read = (f: string) => readFileSync(new URL(f, dir), "utf8");

  it("NFR-1: attribute values in render templates are always quoted", () => {
    expect(files).toContain("html.ts");
    for (const f of files) expect(read(f), f).not.toMatch(/=\s*\$\{/);
  });

  it("NFR-1: render sources never call html() directly", () => {
    for (const f of files.filter((f) => f !== "html.ts")) {
      expect(read(f), f).not.toMatch(/\bhtml\(/);
    }
  });
});

describe("html places, edge cases", () => {
  const bad = "javascript:alert(1)";
  it.each([
    ["an upper-case URL attribute", () => html`<a HREF="${bad}">x</a>`],
    ["an upper-case STYLE attribute", () => html`<p STYLE="${"color:red"}">x</p>`],
    ["the action attribute", () => html`<form action="${bad}"></form>`],
    ["the srcset attribute", () => html`<img srcset="${bad}">`],
    ["a > inside an earlier quoted value", () => html`<a title="a>b" ${"onclick=x"}>x</a>`],
    ["a string inside an upper-case SCRIPT", () => html`<SCRIPT>${"alert(1)"}</SCRIPT>`],
  ])("NFR-1: throws for %s", (_name, render) => {
    expect(render).toThrow(BAD);
  });

  it("NFR-1: keeps a > inside a quoted value from ending the tag", () => {
    expect(html`<a title="a>b" href="${"#x"}">y</a>`.html).toBe('<a title="a>b" href="#x">y</a>');
  });
});

describe("html strict template grammar", () => {
  const js = "javascript:alert(1)";
  it.each<[string, () => Html, RegExp]>([
    [
      "an unbalanced nested attribute",
      () => html`${html`<a href="`}${js}">x</a>`,
      /leave a tag open/,
    ],
    ["an unbalanced nested script", () => html`${html`<script>`}${"alert(1)"}`, /leave a tag open/],
    [
      "code before a value in script",
      () => html`<!doctype html><script>var a = ${"x"}</script>`,
      /fixed/,
    ],
    ["a comment holding a >", () => html`<!-- a > b ${"x"} -->`, /comments/],
    [
      "a single-quoted value with a >",
      () => html`<a title='a>b' href="${js}">x</a>`,
      /double-quoted/,
    ],
    ["a static href prefix", () => html`<a href="javascript:${"#x"}">x</a>`, /href/],
    [
      "a </scripts> look-alike",
      () => html`<!doctype html><script>a="</scripts>";${"x"}</script>`,
      /plain text/,
    ],
    ["non-ASCII before a script", () => html`<!doctype html>İ<script>${"x"}</script>`, /fixed/],
    ["a quote outside a value", () => html`<p "><a href=">${js}`, /double-quoted/],
    ["an unquoted value with a quote", () => html`<div title=a"b><a href=">${js}`, /double-quoted/],
    ["a bare <", () => html`a < "b" "<a href=">${js}`, /must start a tag/],
    ["a processing instruction", () => html`<?x "?><a href=">${js}`, /must start a tag/],
    ["CDATA", () => html`<svg><![CDATA["]]><a href=">${js}`, /must start a tag/],
    ["a value after name=x", () => html`<a title=x="${"y"}">x</a>`, /double-quoted/],
    ["an early-closing comment", () => html`<!--><script>-->${"x"}`, /comments/],
    [
      "a comment inside script",
      () => html`<!doctype html><script><!--<script></script>${"x"}`,
      /plain text/,
    ],
    ["textarea content", () => html`<textarea><a title="</textarea><a href=">${js}`, /plain text/],
    [
      "page textarea content",
      () => html`<!doctype html><textarea><a title="</textarea><a href=">${js}`,
      /plain text/,
    ],
    ["style inside svg", () => html`<svg><style><a x="</style>" href="${js}">`, /before svg/],
    [
      "an svg animation target",
      () => html`<svg><set attributeName="href" to="${js}"/></svg>`,
      /to attribute/,
    ],
    [
      "a meta refresh",
      () => html`<meta http-equiv="refresh" content="${"0;url=https://x"}">`,
      /refresh/,
    ],
    ["src", () => html`<img src="${"https://example.com/a.png"}">`, /src attribute/],
    ["xlink:href", () => html`<use xlink:href="${"#n1"}"/>`, /xlink:href attribute/],
    ["an iframe", () => html`<iframe></iframe>${"x"}`, /not allowed/],
    [
      "an unquoted refresh",
      () => html`<meta http-equiv=refresh content="0;url=https://x">`,
      /refresh/,
    ],
    [
      "a single-quoted refresh",
      () => html`<meta http-equiv='refresh' content="0;url=https://x">`,
      /refresh/,
    ],
    [
      "refresh after content",
      () => html`<meta content="${"0;url=https://x"}" http-equiv="refresh">`,
      /refresh/,
    ],
    [
      "html in title",
      () => html`<!doctype html><title>${html`</title>`}<script></title>${"x"}`,
      /plain text/,
    ],
    [
      "an open nested svg",
      () => html`${html`<svg>`}<title><b><script></title>${"x"}`,
      /leave a tag open/,
    ],
    ["a stray </svg>", () => html`</svg><svg><style><b><script></style>${"x"}`, /before svg/],
    ["a mismatched </svg>", () => html`<math></svg><title><b><script></title>${"x"}`, /plain text/],
    [
      "svg desc breakout",
      () => html`<svg><desc><title></svg><style></title><script></style>${"x"}`,
      /plain text/,
    ],
    [
      "svg p breakout",
      () => html`<svg><p><textarea></svg><title></textarea><script></title>${"x"}`,
      /plain text/,
    ],
    [
      "a non-HTML space after a tag name",
      () => html`<title\u00a0><script></title>${"x"}`,
      /double-quoted/,
    ],
    [
      "a non-HTML space in a close tag",
      () => html`<!doctype html><script></script\u00a0><b>${"x"}</b>`,
      /plain text/,
    ],
    ["script in a fragment", () => html`<p></p><script>${html``}</script>`, /full page/],
    [
      "a fixed value closing the script",
      () => html`<!doctype html><script>${html`</SCRIPT><b>`}</script>`,
      /fixed/,
    ],
    [
      "a fixed value holding a comment",
      () => html`<!doctype html><style>${html`<!--`}</style>`,
      /fixed/,
    ],
    [
      "an encoded refresh",
      () =>
        html`<meta data-http-equiv="content-security-policy" http-equiv="&#114;efresh" content="${"x"}">`,
      /CSP meta/,
    ],
    [
      "a nested full page",
      () => html`<svg>${html`<!doctype html><title>${"x"}</title>`}</svg>`,
      /leave a tag open/,
    ],
    [
      "content in a description meta",
      () => html`<meta name="description" content="${"x"}">`,
      /CSP meta/,
    ],
    [
      "content before the CSP http-equiv",
      () => html`<meta content="${"x"}" http-equiv="content-security-policy">`,
      /CSP meta/,
    ],
  ])("NFR-1: rejects %s", (_name, render, why) => {
    expect(render).toThrow(why);
  });

  it.each<[string, () => Html, string]>([
    [
      "a balanced nested value",
      () => html`<p>${html`<b>${"<x>"}</b>`}</p>`,
      "<p><b>&lt;x&gt;</b></p>",
    ],
    [
      "text in title",
      () => html`<title>${"</title><x>"}</title>`,
      "<title>&lt;/title&gt;&lt;x&gt;</title>",
    ],
    ["the doctype", () => html`<!doctype html><p>${"x"}</p>`, "<!doctype html><p>x</p>"],
    [
      "a value after a closed textarea",
      () => html`<textarea>a</textarea><p>${"x"}</p>`,
      "<textarea>a</textarea><p>x</p>",
    ],
    [
      "svg geometry",
      () => html`<svg viewBox="${"0 0 1 1"}"><line x1="${1}" y1="${2}"/></svg>`,
      '<svg viewBox="0 0 1 1"><line x1="1" y1="2"/></svg>',
    ],
    [
      "a csp meta",
      () => html`<meta http-equiv="Content-Security-Policy" content="${"default-src 'none'"}">`,
      `<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;">`,
    ],
  ])("NFR-1: allows %s", (_name, render, out) => {
    expect(render().html).toBe(out);
  });
});
