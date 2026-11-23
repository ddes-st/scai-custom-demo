#!/usr/bin/env node
/**
 * Scan repo /icons/{Set}/32x32/*.png and emit catalog JSON + markdown reference.
 * Run from repo root or bq/: node bq/.cursor/skills/sitecore-icons/scripts/build-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const ICONS_ROOT = path.join(REPO_ROOT, "icons");
const OUT_DIR = path.resolve(__dirname, "../references");

/** Sitecore icon set → when to prefer this library. */
const SET_CONTEXT = {
  Applications:
    "Desktop and application-window metaphors; use for app shells, modules, or tool launchers",
  ApplicationsV2:
    "Updated application icons; prefer over Applications when both match equally",
  Apps:
    "Tile-style app icons; good for dashboards, LaunchPad-like tiles, or mobile app features",
  Business:
    "Business, finance, commerce, KPIs, and organizational workflows",
  BusinessV2:
    "Updated business icons; charts, money, contracts, and enterprise processes",
  Control:
    "UI controls, form widgets, toggles, and editor chrome",
  Core: "Core Sitecore/system items, infrastructure, and platform concepts",
  Core2: "Extended core platform icons (folders, items, workflows)",
  Core3: "Additional core Sitecore metaphors and system objects",
  Database:
    "Database, tables, queries, data sources, and structured content storage",
  Flags: "Country and region flags; use for locale, market, or geography features",
  FlagsV2: "Updated flag icons for locales and regional targeting",
  Imaging:
    "Photography, image editing, galleries, and visual media manipulation",
  LaunchPadIcons:
    "Sitecore LaunchPad tile style; strong match for XP LaunchPad or app shortcuts",
  Multimedia:
    "Audio, video, playlists, and rich media playback or publishing",
  Network:
    "Networking, servers, connectivity, domains, and infrastructure",
  NetworkV2: "Updated network and cloud infrastructure icons",
  Office:
    "General-purpose office UI (DEFAULT for most renderings, templates, and folders)",
  OfficeWhite:
    "Light/white office variants; use on dark UI chrome when Office set is too heavy",
  Other: "Miscellaneous icons that do not fit other sets cleanly",
  People:
    "Users, profiles, teams, roles, contacts, and identity or directory features",
  PeopleV2:
    "Updated people and identity icons; prefer for user-centric components",
  Software:
    "Software development, code, packages, and technical tooling",
  SoftwareV2: "Updated developer and software engineering icons",
  WordProcessing:
    "Documents, text, articles, rich text, and editorial or page content",
};

/** Filename token → selection hints (matched against slug). */
const TOKEN_HINTS = [
  ["add", "create, insert, new item, plus action"],
  ["delete", "remove, trash, destroy, cleanup"],
  ["edit", "modify, pencil, update content"],
  ["copy", "duplicate, clone"],
  ["paste", "clipboard, insert from buffer"],
  ["search", "find, lookup, query, filter"],
  ["folder", "container, directory, group, collection"],
  ["document", "page, item, file, content node"],
  ["window", "dialog, modal, panel, popup"],
  ["chart", "analytics, report, graph, statistics, dashboard"],
  ["graph", "analytics, metrics, visualization"],
  ["user", "person, profile, account, author, member"],
  ["users", "team, group, audience, directory"],
  ["role", "permission, security group, access"],
  ["image", "photo, picture, media, thumbnail, gallery"],
  ["camera", "photo capture, media upload"],
  ["video", "movie, stream, playback, media block"],
  ["audio", "sound, music, podcast, speaker"],
  ["link", "hyperlink, navigation, external URL"],
  ["home", "homepage, start, landing, root"],
  ["mail", "email, message, inbox, notification"],
  ["calendar", "schedule, date, event, appointment"],
  ["clock", "time, duration, timer, history"],
  ["lock", "security, private, protected, permission"],
  ["key", "authentication, unlock, credentials"],
  ["settings", "configuration, preferences, options, gear"],
  ["tool", "utility, wrench, maintenance, admin"],
  ["tag", "label, category, taxonomy, metadata"],
  ["list", "listing, enumeration, bullet, index"],
  ["table", "grid, rows, data table, spreadsheet"],
  ["map", "location, geography, pin, place finder"],
  ["cart", "shopping, product, e-commerce, basket"],
  ["product", "SKU, catalog, merchandise, shop"],
  ["book", "documentation, manual, knowledge base"],
  ["help", "support, question, FAQ, assistance"],
  ["warning", "alert, caution, validation error"],
  ["error", "failure, invalid, broken state"],
  ["info", "information, notice, tooltip"],
  ["star", "favorite, featured, rating, highlight"],
  ["heart", "like, favorite, saved, wishlist"],
  ["flag", "locale, country, marker, report"],
  ["globe", "world, international, web, language"],
  ["cloud", "hosted, SaaS, sync, online service"],
  ["server", "hosting, backend, infrastructure"],
  ["database", "SQL, data source, repository"],
  ["template", "layout, pattern, blueprint, branch"],
  ["component", "rendering, module, building block"],
  ["layout", "grid, structure, page skeleton"],
  ["hero", "banner, spotlight, masthead"],
  ["card", "tile, teaser, summary block, promo"],
  ["promo", "promotion, marketing, CTA block"],
  ["navigation", "menu, nav, sitemap, wayfinding"],
  ["breadcrumb", "trail, hierarchy, path"],
  ["form", "input, survey, submission, fields"],
  ["button", "CTA, action, click target"],
  ["text", "typography, copy, paragraph, label"],
  ["richtext", "HTML, WYSIWYG, formatted content"],
  ["accordion", "expandable, collapsible sections"],
  ["carousel", "slider, slideshow, rotator"],
  ["tabs", "tabbed UI, sections, switcher"],
  ["social", "share, network, community"],
  ["twitter", "X, social post"],
  ["facebook", "social network share"],
  ["linkedin", "professional network"],
  ["youtube", "video platform embed"],
  ["print", "printer, PDF, hard copy"],
  ["export", "download, output, publish out"],
  ["import", "upload, ingest, migration in"],
  ["refresh", "reload, sync, update cache"],
  ["sync", "synchronize, replicate"],
  ["archive", "storage, old content, backup"],
  ["history", "audit, version log, timeline"],
  ["version", "revision, snapshot, branch version"],
  ["workflow", "approval, process, pipeline, state"],
  ["publish", "go live, deployment, release"],
  ["preview", "review, eye, inspect before publish"],
  ["translate", "language, localization, i18n"],
  ["dictionary", "terms, glossary, labels"],
  ["enum", "enumeration, picklist, fixed values"],
  ["validator", "rule, validation, constraint"],
  ["author", "writer, editor, contributor"],
  ["article", "blog post, story, editorial content"],
  ["news", "announcement, press, feed"],
  ["event", "occurrence, conference, schedule item"],
  ["location", "store, dealer, branch, address finder"],
  ["phone", "call, contact, mobile"],
  ["building", "office, company, enterprise site"],
  ["money", "payment, price, finance, billing"],
  ["credit", "payment card, checkout"],
  ["ticket", "support case, helpdesk, booking"],
  ["certificate", "award, compliance, achievement"],
  ["medal", "achievement, badge, recognition"],
  ["puzzle", "integration, piece, extension module"],
  ["plugin", "extension, add-on, module"],
  ["code", "developer, API, snippet, script"],
  ["bug", "defect, issue tracker, debug"],
  ["test", "QA, experiment, trial"],
  ["airplane", "travel, flight, transport"],
  ["car", "automotive, vehicle, dealer"],
  ["health", "medical, wellness, care"],
  ["education", "school, learning, course"],
  ["sport", "fitness, game, athletics"],
];

function humanizeSlug(slug) {
  return slug
    .replace(/\.png$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toLowerCase())
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(words) {
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

function collectKeywordHints(slug) {
  const lower = slug.toLowerCase();
  const hints = new Set();
  for (const [token, hint] of TOKEN_HINTS) {
    if (lower.includes(token)) hints.add(hint);
  }
  return [...hints];
}

function buildDescription(setName, fileName) {
  const slug = fileName.replace(/\.png$/i, "");
  const label = titleCase(humanizeSlug(slug));
  const setHint =
    SET_CONTEXT[setName] ??
    `Icons from the ${setName} set for Sitecore item chrome`;
  const keywordHints = collectKeywordHints(slug);

  const parts = [
    `${label}.`,
    setHint + ".",
  ];

  if (keywordHints.length) {
    parts.push(`Good for: ${keywordHints.slice(0, 4).join("; ")}.`);
  }

  parts.push(
    `Sitecore path: ${setName}/32x32/${fileName}. Use when naming or purpose aligns with "${label.toLowerCase()}".`,
  );

  return parts.join(" ");
}

function listIconSets() {
  return fs
    .readdirSync(ICONS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function collectIcons() {
  const icons = [];
  for (const setName of listIconSets()) {
    const dir32 = path.join(ICONS_ROOT, setName, "32x32");
    if (!fs.existsSync(dir32)) continue;

    for (const entry of fs.readdirSync(dir32, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".png")) continue;

      const sitecorePath = `${setName}/32x32/${entry.name}`;
      const slug = entry.name.replace(/\.png$/i, "");
      icons.push({
        path: sitecorePath,
        set: setName,
        file: entry.name,
        slug,
        name: titleCase(humanizeSlug(slug)),
        description: buildDescription(setName, entry.name),
        keywords: [
          setName.toLowerCase(),
          ...slug.toLowerCase().split("_"),
          ...collectKeywordHints(slug).join(" ").split(/[,;\s]+/),
        ].filter(Boolean),
      });
    }
  }

  icons.sort((a, b) => a.path.localeCompare(b.path));
  return icons;
}

function writeJson(icons) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, "icons-catalog.json");
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        iconRoot: "icons/",
        pathFormat: "{Set}/32x32/{filename}.png",
        defaultSet: "Office",
        total: icons.length,
        sets: listIconSets().map((name) => ({
          name,
          context: SET_CONTEXT[name] ?? "",
          count: icons.filter((i) => i.set === name).length,
        })),
        icons,
      },
      null,
      2,
    ),
    "utf8",
  );
  return out;
}

function writeMarkdownBySet(icons) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const setsDir = path.join(OUT_DIR, "sets");
  fs.mkdirSync(setsDir, { recursive: true });

  const bySet = new Map();
  for (const icon of icons) {
    if (!bySet.has(icon.set)) bySet.set(icon.set, []);
    bySet.get(icon.set).push(icon);
  }

  const indexLines = [
    "# Sitecore icons by set (32x32)",
    "",
    `Total icons: **${icons.length}**`,
    "",
    "| Set | Icons | Reference |",
    "|-----|------:|-----------|",
  ];

  for (const setName of [...bySet.keys()].sort()) {
    const setIcons = bySet.get(setName) ?? [];
    const fileName = `${setName}.md`;
    const lines = [
      `# ${setName} (32x32)`,
      "",
      SET_CONTEXT[setName] ?? "",
      "",
      "| Path | Name | Description |",
      "|------|------|-------------|",
    ];

    for (const icon of setIcons) {
      const desc = icon.description.replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| \`${icon.path}\` | ${icon.name} | ${desc} |`);
    }
    lines.push("");

    fs.writeFileSync(path.join(setsDir, fileName), lines.join("\n"), "utf8");
    indexLines.push(
      `| ${setName} | ${setIcons.length} | [${setName}.md](sets/${fileName}) |`,
    );
  }

  fs.writeFileSync(path.join(OUT_DIR, "README.md"), indexLines.join("\n"), "utf8");
}

function writeCompactIndex(icons) {
  const lines = [
    "# Sitecore 32x32 icon index (compact)",
    "",
    "One line per icon: `path` — description",
    "",
  ];
  for (const icon of icons) {
    lines.push(`- \`${icon.path}\` — ${icon.description}`);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "icons-catalog-compact.md"),
    lines.join("\n"),
    "utf8",
  );
}

function main() {
  if (!fs.existsSync(ICONS_ROOT)) {
    console.error(`Icons folder not found: ${ICONS_ROOT}`);
    process.exit(1);
  }

  const icons = collectIcons();
  const jsonPath = writeJson(icons);
  writeMarkdownBySet(icons);
  writeCompactIndex(icons);

  console.log(`Catalog: ${icons.length} icons`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Sets: ${path.join(OUT_DIR, "sets")}`);
}

main();
