declare const brand: unique symbol;
export type Html = { readonly html: string; readonly [brand]: true };

type Place =
  | { kind: "text" | "rcdata" | "raw" }
  | { kind: "attr"; name: string; prefix: string }
  | { kind: "bad"; why: string };

type Site = { places: Place[]; balanced: boolean; refresh: boolean };

const trusted = new WeakSet<object>();
const fixed = new WeakSet<object>();
const balanced = new WeakSet<object>();
const sites = new WeakMap<TemplateStringsArray, Site>();

const DOCTYPE = "<!doctype html>";
const VALUE_ATTRS =
  /^(id|class|href|title|lang|for|datetime|content|width|height|viewbox|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|d|points|transform|aria-[a-z]+|data-[a-z-]+)$/;
const TAG = /^<(\/?)([a-z][a-z0-9-]*)/;
const TAG_END = /^[\t\n\f\r ]*\/?>/;
const OPEN_VALUE = /^[\t\n\f\r ]+([a-z][a-z0-9:-]*)="([^"]*)$/;
const ATTRIBUTE = /^[\t\n\f\r ]+[a-z][a-z0-9:-]*(?:="[^"]*")?(?=[\t\n\f\r />])/;
const RAW = new Set(["script", "style"]);
const RCDATA = new Set(["title", "textarea"]);
const BANNED = new Set(["xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"]);

export const isHtml = (value: unknown): value is Html =>
  typeof value === "object" && value !== null && trusted.has(value);

const fail = (why: string): never => {
  throw new Error(`html: ${why}`);
};

const bad = (why: string): Place => ({ kind: "bad", why });

const lowerAscii = (text: string) => text.replace(/[A-Z]/g, (c) => c.toLowerCase());

const escapeText = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const isClose = (s: string, at: number, name: string) =>
  new RegExp(`^</${name}[\\t\\n\\f\\r />]`).test(s.slice(at));

function placeOf(before: string): Place {
  const s = lowerAscii(before);
  let page = s.startsWith(DOCTYPE);
  for (let i = s.indexOf("<", page ? DOCTYPE.length : 0); i >= 0; i = s.indexOf("<", i)) {
    const [open = "", slash, name = ""] = TAG.exec(s.slice(i)) ?? [];
    if (!open) return bad("a < in a template must start a tag (no comments or <!, <?)");
    const tag = i;
    for (let j = i + open.length; ; ) {
      const end = TAG_END.exec(s.slice(j));
      if (end) {
        i = j + end[0].length;
        break;
      }
      const value = OPEN_VALUE.exec(s.slice(j));
      if (value) return attrPlace(value[1] ?? "", value[2] ?? "", s.slice(tag));
      const attribute = ATTRIBUTE.exec(s.slice(j));
      if (!attribute) return bad("a value in a tag must be in a double-quoted attribute");
      j += attribute[0].length;
    }
    if (name === "svg" || name === "math") page = false;
    if (slash) continue;
    if (BANNED.has(name)) return bad(`<${name}> is not allowed`);
    if (RAW.has(name) && !page) return bad(`<${name}> is only allowed in a full page, before svg`);
    if (!RAW.has(name) && !RCDATA.has(name)) continue;
    const close = s.indexOf("<", i);
    if (close < 0) return { kind: RAW.has(name) ? "raw" : "rcdata" };
    if (!isClose(s, close, name)) return bad(`<${name}> content must be plain text`);
    i = close;
  }
  return { kind: "text" };
}

function attrPlace(name: string, prefix: string, tag: string): Place {
  if (!VALUE_ATTRS.test(name)) return bad(`a value cannot go in the ${name} attribute`);
  if (
    name === "content" &&
    tag !== `<meta http-equiv="content-security-policy" content="${prefix}`
  ) {
    return bad("content takes a value only in a CSP meta");
  }
  return { kind: "attr", name, prefix };
}

function foreignClosed(s: string): boolean {
  const open: string[] = [];
  for (const [, slash, name = ""] of s.matchAll(/<(\/?)(svg|math)(?=[\t\n\f\r />])/g)) {
    if (!slash) open.push(name);
    else if (open.pop() !== name) return false;
  }
  return open.length === 0;
}

function text(value: unknown, nested: boolean): string {
  if (value === null || value === undefined || value === false) return "";
  if (isHtml(value)) {
    if (!nested) return fail("an html value can only go in plain text");
    return balanced.has(value) ? value.html : fail("a nested html value must not leave a tag open");
  }
  if (!Array.isArray(value)) return escapeText(String(value));
  let out = "";
  for (let i = 0; i < value.length; i++) out += text(value[i], nested);
  return out;
}

function part(value: unknown, place: Place): string {
  if (place.kind === "bad") return fail(place.why);
  if (place.kind === "raw") {
    const safe = isHtml(value) && fixed.has(value) && !/<\/script|<\/style|<!--/i.test(value.html);
    if (safe) return value.html;
    return fail("only a fixed html value can go inside <script> or <style>");
  }
  if (place.kind !== "attr") return text(value, place.kind === "text");
  if (Array.isArray(value)) fail("an array cannot go in an attribute");
  const out = text(value, false);
  const url = place.prefix.startsWith("#") || (!place.prefix && /^(https:\/\/|#)/.test(out));
  if (place.name === "href" && !url) fail("href must be an https URL or a #anchor");
  return out;
}

function siteOf(strings: TemplateStringsArray): Site {
  const all = lowerAscii(strings.join(""));
  return {
    places: strings.slice(1).map((_, i) => placeOf(strings.slice(0, i + 1).join(""))),
    balanced: !all.startsWith(DOCTYPE) && placeOf(all).kind === "text" && foreignClosed(all),
    refresh: /http-equiv[\t\n\f\r ]*=[\t\n\f\r ]*["']?[\t\n\f\r ]*refresh/.test(all),
  };
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
  if (
    !Object.isFrozen(strings) ||
    !Array.isArray(strings.raw) ||
    strings.length !== values.length + 1
  ) {
    fail("use html as a tagged template");
  }
  const site = sites.get(strings) ?? siteOf(strings);
  sites.set(strings, site);
  if (site.refresh) fail("a meta refresh is not allowed");
  const out = site.places.reduce(
    (acc, place, i) => acc + part(values[i], place) + strings[i + 1],
    strings[0],
  );
  const result = Object.freeze({ html: out }) as Html;
  trusted.add(result);
  if (values.length === 0) fixed.add(result);
  if (site.balanced) balanced.add(result);
  return result;
}
