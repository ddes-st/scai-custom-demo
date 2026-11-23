import { braceGuid } from "./ids";

/**
 * Naming helpers aligned with
 * `.cursor/sitecore-yaml/.../Generate-SitecoreRendering.mjs`.
 */

/**
 * Characters stripped from Sitecore item names (InvalidItemNameChars-style),
 * verified against the CM UI (also blocks `( )` which classic configs sometimes allow).
 * Includes `.` (names cannot end with a period) and smart quotes — CM ItemNameValidation
 * is `^[\w\*\$][\w\s\-\$]*(\(\d{1,}\)){0,1}$`.
 */
export const INVALID_ITEM_NAME_CHARS: readonly string[] = [
  "\\",
  "/",
  ":",
  "?",
  '"',
  "'",
  "`",
  "´",
  "<",
  ">",
  "|",
  "[",
  "]",
  "(",
  ")",
  "#",
  ";",
  ".",
  ",",
  "!",
  "\u2018", // ‘
  "\u2019", // ’
  "\u201A", // ‚
  "\u201B", // ‛
  "\u201C", // “
  "\u201D", // ”
  "\u2032", // ′
  "\u2033", // ″
  "\t",
  "\r",
  "\n",
  "\0",
];

/** URL-safe kebab leaf: lowercase letters, digits, `-`, `*`, `$`. */
const KEBAB_ITEM_NAME_VALIDATION = /^[a-z0-9*$][a-z0-9\-*$]*$/;

/**
 * Display-style Sitecore ItemNameValidation without the optional trailing `(digits)`
 * (parentheses are stripped — clone suffixes use other uniquifiers).
 */
const DISPLAY_ITEM_NAME_VALIDATION = /^[\w*$][\w\s\-$]*$/;

export type ProposeValidItemNameOptions = {
  /**
   * When true, force kebab-case (lowercase, spaces → `-`).
   * Use only for items under a site `Home` (URL-routable content).
   */
  forUrl?: boolean;
};

/**
 * True when the Sitecore path is a **URL-routable descendant** of a site `Home`
 * item (e.g. `…/content/{collection}/{site}/Home/About`).
 *
 * Only the site page node counts — not datasource groups named `Home`
 * (e.g. `…/Data/Link Lists/Home/…`). Excludes the `Home` item itself and
 * non-routable trees under Home such as `…/Home/Data/…`.
 */
export function isUnderSiteHome(sitecorePath: string): boolean {
  const parts = sitecorePath.replace(/\\/g, "/").split("/").filter(Boolean);
  // …/content/{collection}/{site}/Home/{descendant}
  const contentIdx = parts.findIndex((p) => p.toLowerCase() === "content");
  if (contentIdx < 0) return false;
  const homeIdx = contentIdx + 3;
  if (parts[homeIdx] !== "Home") return false;
  if (homeIdx >= parts.length - 1) return false;
  const afterHome = parts.slice(homeIdx + 1);
  // Datasource folders under pages are not public URL segments.
  if (afterHome.includes("Data")) return false;
  return true;
}

/**
 * True when `name` is a valid BQ kebab-case Sitecore item name (URL leaf).
 */
export function isValidSitecoreItemName(name: string): boolean {
  return KEBAB_ITEM_NAME_VALIDATION.test(name);
}

/** Strip Sitecore-invalid characters; preserve casing and spaces. */
export function stripInvalidItemNameChars(name: string): string {
  let proposed = name.trim();
  for (const ch of INVALID_ITEM_NAME_CHARS) {
    if (proposed.includes(ch)) {
      proposed = proposed.split(ch).join("");
    }
  }
  // Drop any remaining chars outside ItemNameValidation allowlist.
  proposed = proposed.replace(/[^\w\s\*$\-]/g, "");
  // Collapse runs of whitespace to a single space (display-friendly, still valid).
  proposed = proposed.replace(/\s+/g, " ").trim();
  // First char must be word / * / $ (strip leading spaces/hyphens left after cleanup).
  proposed = proposed.replace(/^[^\w*$]+/, "").trim();
  return proposed;
}

/**
 * Convert to kebab-case Sitecore item name: lowercase, spaces/underscores/camelCase
 * → `-`, strip invalid chars. Keeps `*` and `$` (Sitecore / UI special cases).
 */
export function toKebabItemName(name: string): string {
  let proposed = name.trim();
  for (const ch of INVALID_ITEM_NAME_CHARS) {
    if (proposed.includes(ch)) {
      proposed = proposed.split(ch).join("");
    }
  }

  proposed = proposed
    // camelCase / PascalCase → kebab boundaries
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    // drop anything not allowed in the final allowlist
    .replace(/[^a-z0-9\-*$]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return proposed;
}

/**
 * Propose a valid Sitecore item name.
 *
 * - Default (`forUrl: false`): keep definition casing/spaces; only strip invalid chars
 *   (templates, renderings, Data, media, Field Rules, …).
 * - `forUrl: true`: kebab-case for items under site `Home` (public URLs).
 */
export function proposeValidItemName(
  name: string,
  defaultValue = "unnamed-item",
  options?: ProposeValidItemNameOptions,
): string {
  if (options?.forUrl) {
    let proposed = toKebabItemName(name);
    if (!proposed) {
      proposed = toKebabItemName(defaultValue);
    }
    return proposed || "unnamed-item";
  }

  let proposed = stripInvalidItemNameChars(name);
  if (!proposed || !DISPLAY_ITEM_NAME_VALIDATION.test(proposed)) {
    proposed = stripInvalidItemNameChars(defaultValue);
  }
  if (!proposed || !DISPLAY_ITEM_NAME_VALIDATION.test(proposed)) {
    return "unnamed-item";
  }
  return proposed;
}

/**
 * Sanitize the **leaf** segment of a Sitecore path only.
 * Ancestor segments must keep the parent item’s Path casing/spelling so SCS
 * serialization stays consistent (`ser validate` INVALID PATH otherwise).
 *
 * Leaf uses kebab-case only when the path is under a site `Home` item.
 */
export function proposeValidSitecorePath(sitecorePath: string): string {
  const parts = sitecorePath.split("/");
  let leafIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) {
      leafIdx = i;
      break;
    }
  }
  if (leafIdx < 0) return sitecorePath;
  const leaf = parts[leafIdx]!;
  const forUrl = isUnderSiteHome(sitecorePath);
  parts[leafIdx] = proposeValidItemName(leaf, leaf, { forUrl });
  return parts.join("/");
}

/**
 * Collapse line breaks / Unicode separators into a single-line string.
 * Use for site/collection Name + Description before Sites API or SCS YAML
 * so bare `Value:` scalars never split mid-field (CORRUPT FILE → orphan cascade).
 */
export function sanitizeSingleLineText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[\r\n\u2028\u2029\u0085\u000b\u000c]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Peel one whole-string wrapping quote layer from field / display / link values.
 *
 * Fixes evaluated `JSON.stringify('welkom')` → `"welkom"` (quotes included) and
 * link-XML extracts like `&quot;welkom&quot;`. Does **not** strip mid-string quotes
 * (`Say "hi"` stays). Distinct from {@link proposeValidItemName} (Path rules).
 */
export function unwrapStringValue(value: string): string {
  let s = String(value ?? "").trim();
  if (!s) return s;

  const entity =
    /^&quot;([\s\S]*)&quot;$/i.exec(s) ||
    /^&#34;([\s\S]*)&#34;$/i.exec(s) ||
    /^&#x22;([\s\S]*)&#x22;$/i.exec(s);
  if (entity) {
    s = entity[1] ?? s;
  }

  if (s.length >= 2 && s.startsWith('"')) {
    try {
      const parsed = JSON.parse(s);
      if (typeof parsed === "string") return parsed;
    } catch {
      /* not a JSON string literal */
    }
  }

  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
    const inner = s.slice(1, -1);
    if (!inner.includes("'")) return inner;
  }

  return s;
}

/**
 * Sitecore `__Display name` / content `displayName` must be single-line plain text.
 * Strips HTML tags and common entities; does **not** apply Path
 * {@link proposeValidItemName} rules (keeps punctuation needed in labels).
 * Distinct from Rich Text field seeds (Body may keep `<p>…</p>`).
 */
export function toPlainDisplayName(value: string): string {
  let s = unwrapStringValue(String(value ?? ""));
  if (!s) return "";

  // Tags → space so adjacent words do not glue (`</p><p>` → gap).
  s = s.replace(/<[^>]+>/g, " ");

  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");

  return sanitizeSingleLineText(s);
}

export function toSystemName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** PascalCase component name for Sitecore componentName / item names. */
export function toPascalComponentName(input: string): string {
  const trimmed = input.trim();
  if (/^[A-Z][A-Za-z0-9]*$/.test(trimmed)) return trimmed;
  return trimmed
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/**
 * Spaced Title Case for Sitecore template leaf names (e.g. `Trust Metrics`).
 * Prefer feeding `displayName`; falls back to splitting PascalCase.
 */
export function toSpacedItemName(input: string): string {
  const trimmed = String(input || "").trim();
  if (!trimmed) return trimmed;
  if (/[\s_-]/.test(trimmed)) {
    return trimmed
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return trimmed
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
}

/** Platform Data folders that must keep their exact names. */
export const PLATFORM_DATA_FOLDER_NAMES = [
  "Link Lists",
  "Icon Link Lists",
  "Image Link Lists",
] as const;

const PLATFORM_DATA_FOLDER_SET = new Set<string>(
  PLATFORM_DATA_FOLDER_NAMES.map((n) => n.toLowerCase()),
);

/**
 * Spaced Title Case for a site `Data/…` folder segment.
 * Preserves platform link-list folder names exactly.
 */
export function toSpacedDataFolderSegment(input: string): string {
  const trimmed = String(input || "").trim();
  if (!trimmed) return trimmed;
  if (PLATFORM_DATA_FOLDER_SET.has(trimmed.toLowerCase())) {
    return (
      PLATFORM_DATA_FOLDER_NAMES.find(
        (n) => n.toLowerCase() === trimmed.toLowerCase(),
      ) ?? trimmed
    );
  }
  return toSpacedItemName(trimmed);
}

/** Normalize every segment in a `location.folder` / `datasourceLocation.folder` array. */
export function normalizeDataFolderSegments(
  folder: string[] | undefined | null,
): string[] | undefined {
  if (!folder?.length) return folder ?? undefined;
  return folder.map(toSpacedDataFolderSegment);
}

export function pluralComponentName(name: string): string {
  return `${name}s`;
}

/** Definition-friendly General Link input (no Sitecore XML required). */
export type GeneralLinkInput = {
  /** Link text (defaults to `url` when omitted). */
  text?: string;
  url: string;
  target?: string;
  anchor?: string;
  title?: string;
  class?: string;
  querystring?: string;
  /**
   * Sitecore item GUID for `linktype="internal"` (with or without braces).
   * Emitted as uppercase braced `id="{…}"` to match `dotnet sitecore ser pull`.
   */
  id?: string;
  /** Override auto-detected link type. */
  linktype?:
    | "external"
    | "internal"
    | "anchor"
    | "mailto"
    | "javascript";
};

export function inferLinkType(url: string): NonNullable<GeneralLinkInput["linktype"]> {
  const u = url.trim();
  if (/^mailto:/i.test(u)) return "mailto";
  if (/^javascript:/i.test(u)) return "javascript";
  if (u.startsWith("#")) return "anchor";
  if (/^https?:\/\//i.test(u)) return "external";
  // Sitecore item GUID only → internal. Site-relative paths from capture are external
  // (no item id); Layout Service Link needs linktype=external for those URLs.
  if (
    /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(
      u,
    )
  ) {
    return "internal";
  }
  return "external";
}

/**
 * Split `path#frag` / `#frag` into base URL and fragment (without `#`).
 * Leaves mailto:/javascript: URLs untouched.
 */
export function splitUrlHash(url: string): { url: string; fragment: string } {
  const u = String(url ?? "").trim();
  if (!u) return { url: "/", fragment: "" };
  if (/^mailto:/i.test(u) || /^javascript:/i.test(u)) {
    return { url: u, fragment: "" };
  }
  const hashIdx = u.indexOf("#");
  if (hashIdx < 0) return { url: u, fragment: "" };
  const before = u.slice(0, hashIdx);
  const fragment = u.slice(hashIdx + 1);
  if (!before) {
    return { url: `#${fragment}`, fragment };
  }
  return { url: before, fragment };
}

/** Normalize Sitecore `anchor` value (strip leading `#`). */
export function normalizeAnchorValue(raw: string | undefined | null): string {
  const a = String(raw ?? "").trim();
  if (!a) return "";
  return a.startsWith("#") ? a.slice(1) : a;
}

/**
 * Encode definition link values to Sitecore General Link XML.
 *
 * Accepts:
 * - `{ text, url, target?, … }` object
 * - bare `"url"` (text defaults to url)
 * - already-encoded `<link … />` (passed through)
 */
export function encodeGeneralLink(
  input: string | GeneralLinkInput,
): string {
  if (typeof input === "string") {
    const trimmed = unwrapStringValue(input);
    if (trimmed.startsWith("<link")) return trimmed;
    const url = trimmed || "/";
    return buildLinkXml({ text: url, url });
  }

  return buildLinkXml({
    ...input,
    text:
      typeof input.text === "string"
        ? unwrapStringValue(input.text)
        : input.text,
    url: unwrapStringValue(String(input.url ?? "")),
    title:
      typeof input.title === "string"
        ? unwrapStringValue(input.title)
        : input.title,
  });
}

/**
 * @deprecated Prefer {@link encodeGeneralLink}. Kept for component definitions.
 */
export function encodeGeneralLinkDefault(raw: string): string {
  return encodeGeneralLink(raw);
}

function buildLinkXml(input: GeneralLinkInput): string {
  const rawUrl = (input.url ?? "/").trim() || "/";
  const { url: splitUrl, fragment } = splitUrlHash(rawUrl);
  const explicitAnchor = normalizeAnchorValue(input.anchor);
  const anchor = explicitAnchor || normalizeAnchorValue(fragment);
  // Infer from original URL so bare `#frag` stays linktype=anchor.
  const linktype = input.linktype ?? inferLinkType(rawUrl);
  // Strip hash from path/URL; keep `#frag` form for pure anchors.
  const url =
    linktype === "anchor" && rawUrl.startsWith("#")
      ? rawUrl
      : splitUrl || "/";
  // Prefer explicit link label; never silently drop a provided text.
  // Empty/whitespace text falls back to url so Sitecore always has a label.
  const rawText = typeof input.text === "string" ? input.text.trim() : "";
  const text = rawText || url;
  const attrs: Array<[string, string]> = [
    ["text", text],
    ["linktype", linktype],
    ["url", url],
    ["anchor", anchor],
    ["target", input.target ?? ""],
  ];
  const itemId = (input.id ?? "").trim();
  if (itemId && linktype === "internal") {
    // Pull serializes General Link id as uppercase braced GUID.
    attrs.push(["id", braceGuid(itemId)]);
  }
  if (input.title !== undefined) attrs.push(["title", input.title]);
  if (input.class !== undefined) attrs.push(["class", input.class]);
  if (input.querystring !== undefined) {
    attrs.push(["querystring", input.querystring]);
  }
  const body = attrs
    .map(([key, value]) => `${key}="${escapeXml(value)}"`)
    .join(" ");
  return `<link ${body} />`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Base placeholder key for definitions / AppPlaceholder (no `-{*}` suffix).
 */
export function toBasePlaceholderKey(key: string): string {
  const k = String(key || "").trim();
  if (!k) return k;
  return k.replace(/-\{\*\}$/, "").replace(/\{\*\}$/, "");
}

/**
 * Sitecore Placeholder Settings "Placeholder Key" field value (`base-{*}`).
 * Idempotent when already suffixed.
 */
export function ensureDynamicPlaceholderKey(key: string): string {
  const base = toBasePlaceholderKey(key);
  if (!base) return base;
  return `${base}-{*}`;
}

/**
 * Map definition field shapes to Sitecore Type strings
 * (from sitecore-yaml field-types.md).
 */
export function sitecoreFieldTypeFromShape(
  shape: string,
  explicit?: string,
): string {
  if (explicit) {
    const normalized = explicit.trim();
    // Accept both "general-link" and "General Link"
    if (normalized.toLowerCase() === "general-link") return "General Link";
    if (normalized.toLowerCase() === "checkbox") return "Checkbox";
    if (normalized.toLowerCase() === "single-line text") return "Single-Line Text";
    return normalized;
  }
  switch (shape) {
    case "link":
      return "General Link";
    case "richtext":
      return "Rich Text";
    case "image":
      return "Image";
    case "checkbox":
    case "boolean":
      return "Checkbox";
    case "enum":
      return "Droplink";
    case "number":
      return "Integer";
    default:
      return "Single-Line Text";
  }
}
