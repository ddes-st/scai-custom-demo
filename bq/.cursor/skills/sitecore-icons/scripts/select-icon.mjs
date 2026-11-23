#!/usr/bin/env node
/**
 * Rank Sitecore icons for a component/template name or description.
 *
 * Usage:
 *   node select-icon.mjs "custom card component with image and link"
 *   node select-icon.mjs "user profile author directory"
 *   node select-icon.mjs --set Office "dialog window settings"
 *
 * Programmatic:
 *   import { selectBestIcon } from './select-icon.mjs';
 *   const { path } = selectBestIcon('advisor support split broker');
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = path.resolve(__dirname, "../references/icons-catalog.json");
const FALLBACK_PATH = "Office/32x32/document.png";

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

const SYNONYMS = {
  cta: ["button", "action"],
  card: ["tile", "teaser", "promo", "panel", "dialog"],
  hero: ["banner", "spotlight", "masthead"],
  nav: ["navigation", "menu"],
  rte: ["richtext", "text", "document"],
  i18n: ["translate", "language", "dictionary"],
  enum: ["enumeration", "list"],
  params: ["settings", "parameters", "configuration"],
  author: ["user", "writer", "profile"],
  article: ["document", "story", "news"],
  image: ["photo", "picture", "media"],
  video: ["movie", "multimedia"],
  search: ["find", "query", "lookup"],
  form: ["input", "survey", "fields"],
  location: ["map", "pin", "place"],
  product: ["catalog", "shop", "cart"],
  advisor: ["user", "support", "help"],
  broker: ["user", "agent", "support"],
  split: ["panel", "layout", "window"],
  slider: ["carousel", "gallery"],
  footer: ["navigation", "menu"],
  header: ["navigation", "menu"],
  pillar: ["card", "tile", "panel"],
  category: ["catalog", "grid", "list"],
  grid: ["list", "catalog", "table"],
  consent: ["lock", "security", "privacy"],
  banner: ["window", "dialog", "alert"],
};

function expandQueryTokens(queryTokens) {
  const expanded = new Set(queryTokens);
  for (const token of queryTokens) {
    for (const alt of SYNONYMS[token] ?? []) expanded.add(alt);
  }
  return [...expanded];
}

function slugTokens(slug) {
  return slug.toLowerCase().split("_").filter(Boolean);
}

function scoreIcon(icon, queryTokens, preferredSet) {
  let score = 0;
  const slug = icon.slug.toLowerCase();
  const slugParts = slugTokens(slug);
  const name = icon.name.toLowerCase();
  const desc = icon.description.toLowerCase();
  const keywords = (icon.keywords ?? []).map((k) => k.toLowerCase());
  const expanded = expandQueryTokens(queryTokens);

  for (const token of expanded) {
    if (slug === token) score += 50;
    else if (slugParts.includes(token)) score += 28;
    else if (slug.includes(token)) score += 18;
    else if (name.includes(token)) score += 12;
    else if (keywords.some((k) => k === token)) score += 10;
    else if (desc.includes(token)) score += 6;
  }

  // Boost when multiple query tokens hit the slug (e.g. window + dialog → window_dialog)
  const slugHits = queryTokens.filter(
    (t) => slugParts.includes(t) || slug.includes(t),
  ).length;
  if (slugHits >= 2) score += slugHits * 15;

  // Strong boost for canonical content-card / dialog icons
  if (
    slug === "window_dialog" &&
    (queryTokens.includes("dialog") ||
      queryTokens.includes("card") ||
      queryTokens.includes("window"))
  ) {
    score += 45;
  }

  // Penalize misleading "card" matches (payment/test/hardware cards)
  if (
    queryTokens.includes("card") &&
    /(?:credit|debit|pci|playing|test|terminal|hand)_?card|card_terminal/.test(
      slug,
    )
  ) {
    score -= 40;
  }

  if (preferredSet && icon.set === preferredSet) score += 8;
  if (icon.set === "Office") score += 3;

  return score;
}

/**
 * @param {string} query
 * @param {{ preferredSet?: string, catalogPath?: string, setOnly?: boolean }} [options]
 * @returns {{ path: string, name?: string, set?: string, description?: string, fallback?: boolean, alternatives?: object[] }}
 */
export function selectBestIcon(query, options = {}) {
  const preferredSet = options.preferredSet;
  const setOnly = Boolean(options.setOnly);
  const catalogPath = options.catalogPath || CATALOG;
  const q = String(query || "").trim();

  if (!q) {
    return { path: FALLBACK_PATH, fallback: true };
  }

  if (!fs.existsSync(catalogPath)) {
    return { path: FALLBACK_PATH, fallback: true, missingCatalog: true };
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const queryTokens = tokenize(q);

  let icons = catalog.icons || [];
  if (setOnly && preferredSet) {
    icons = icons.filter((icon) => icon.set === preferredSet);
  }

  const ranked = icons
    .map((icon) => ({ icon, score: scoreIcon(icon, queryTokens, preferredSet) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.icon.path.localeCompare(b.icon.path));

  const best = ranked[0]?.icon;
  if (!best) {
    return { path: FALLBACK_PATH, fallback: true };
  }

  return {
    path: best.path,
    name: best.name,
    set: best.set,
    description: best.description,
    alternatives: ranked.slice(1, 6).map((r) => ({
      path: r.icon.path,
      score: r.score,
      name: r.icon.name,
    })),
  };
}

function main() {
  const args = process.argv.slice(2);
  let preferredSet;
  let queryParts = args;

  const setIdx = args.indexOf("--set");
  if (setIdx >= 0) {
    preferredSet = args[setIdx + 1];
    queryParts = args.filter((_, i) => i !== setIdx && i !== setIdx + 1);
  }

  const query = queryParts.join(" ").trim();
  if (!query) {
    console.error(
      'Usage: node select-icon.mjs [--set Office] "component name or description"',
    );
    process.exit(1);
  }

  if (!fs.existsSync(CATALOG)) {
    console.error(
      `Catalog missing. Run: node bq/.cursor/skills/sitecore-icons/scripts/build-catalog.mjs`,
    );
    process.exit(1);
  }

  const output = selectBestIcon(query, { preferredSet });
  if (output.fallback && !output.name) {
    console.log(JSON.stringify({ path: output.path, fallback: true }));
    process.exit(0);
  }

  console.log(JSON.stringify(output, null, 2));
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
