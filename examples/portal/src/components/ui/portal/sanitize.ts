/**
 * HTML sanitizer for CH-authored rich text rendered via dangerouslySetInnerHTML — an
 * ALLOWLIST: only the formatting tags rich text uses, only harmless attributes, only safe
 * URL schemes. Everything else is unwrapped (its text kept) or, for active content (script,
 * svg, math, embeds, forms), dropped with its children. (The earlier blocklist let an SVG
 * <animate> rewrite a link's href to javascript:.)
 *
 * DOMParser is used to parse, not the live document: parseFromString("text/html") builds an
 * inert document, so nothing executes while we clean it.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "b", "strong", "i", "em", "u", "s", "strike", "del", "ins", "sub", "sup", "small", "mark", "span", "div",
  "blockquote", "q", "cite", "code", "pre", "kbd", "abbr", "time", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd", "a", "img", "figure", "figcaption",
  "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
]);

/** Removed together with everything inside them. */
const DROPPED_TAGS = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "svg", "math", "template", "noscript",
  "form", "input", "button", "textarea", "select", "option", "link", "meta", "base", "video", "audio", "source", "track", "canvas", "portal",
]);

const GLOBAL_ATTRS = new Set(["title", "class", "lang", "dir"]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  ol: new Set(["start", "type"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
  time: new Set(["datetime"]),
  q: new Set(["cite"]),
  blockquote: new Set(["cite"]),
};

/**
 * Strip characters browsers ignore when resolving a URL scheme, so obfuscated payloads such as
 * "java\tscript:" or "  JAVASCRIPT&#58;" cannot slip past the scheme check.
 */
function normalizeUrl(value: string): string {
  // C0/C1 controls, space, and the zero-width & BOM characters browsers strip from URLs
  return value.replace(/[\u0000-\u0020\u00a0\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\ufeff]/g, "").toLowerCase();
}

function safeUrl(attr: string, value: string): boolean {
  const url = normalizeUrl(value);
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(url)?.[1];
  if (!scheme) return true; // relative, #anchor, /path
  if (scheme === "http" || scheme === "https") return true;
  if (attr === "href") return scheme === "mailto" || scheme === "tel";
  // data: images on src are the one inline exception — CMP inlines small images that way
  return attr === "src" && /^data:image\/(png|jpe?g|gif|webp);/.test(url);
}

function cleanChildren(source: Node, target: Node, doc: Document): void {
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === 3) {
      target.appendChild(doc.createTextNode(child.textContent ?? ""));
      continue;
    }
    if (child.nodeType !== 1) continue; // comments, processing instructions
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (DROPPED_TAGS.has(tag)) continue;
    if (!ALLOWED_TAGS.has(tag)) {
      cleanChildren(el, target, doc); // unwrap: keep the text, lose the tag
      continue;
    }
    const out = doc.createElement(tag);
    const allowed = TAG_ATTRS[tag];
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!GLOBAL_ATTRS.has(name) && !allowed?.has(name)) continue;
      if ((name === "href" || name === "src" || name === "cite") && !safeUrl(name === "cite" ? "href" : name, attr.value)) continue;
      out.setAttribute(name, attr.value);
    }
    // links that open a new tab must not hand the opener over
    if (tag === "a" && (out.getAttribute("target") || "").toLowerCase() === "_blank") out.setAttribute("rel", "noopener noreferrer");
    cleanChildren(el, out, doc);
    target.appendChild(out);
  }
}

/** Clean an already-parsed (inert) document's body; used by both the browser and the server. */
export function cleanHtml(doc: Document): string {
  const container = doc.createElement("div");
  cleanChildren(doc.body, container, doc);
  return container.innerHTML;
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";
  try {
    return cleanHtml(new DOMParser().parseFromString(html, "text/html"));
  } catch {
    // DOMParser unavailable — degrade to escaped text rather than raw HTML
    return html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
