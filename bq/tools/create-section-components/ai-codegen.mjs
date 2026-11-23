/**
 * Shared evidence packing + prompt helpers for codegen (and layout critique).
 * Legacy v1/v2 decompose/codegen paths were removed — use section-codegen.mjs.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  imageContentPart,
} from '../capture/lib/design-system/ai/azure-chat.mjs';
import { loadLocalEnvFiles } from '../capture/lib/design-system/load-env.mjs';
import {
  ORIGINAL_SECTION_HTML,
  SECTION_HTML,
} from '../capture/lib/section-html-files.mjs';
import { bqRoot } from '../capture/paths.mjs';
import {
  FIELD_CATALOG_REFERENCE_REL,
  resolveReferenceRelsForCodegen,
} from './reference-types.mjs';
import {
  resolveEvidenceViewportOrder,
  VIEWPORTS,
} from '../capture/lib/viewports.mjs';
import sharp from 'sharp';

/** Env: which evidence leads decompose/codegen — `html` (default) or `png`. */
export const BQ_CODEGEN_EVIDENCE_MODE = 'BQ_CODEGEN_EVIDENCE_MODE';

/**
 * Resolve evidence mode for decompose/codegen packing.
 * - `html` (default): CSS-inlined section.html, no viewport PNG attachments
 * - `png`: original-section.html + viewport PNG attachments
 *
 * Aliases: `html-leading` → `html`, `png-leading` → `png`.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'html'|'png'}
 */
export function resolveCodegenEvidenceMode(env = process.env) {
  const v = String(env?.[BQ_CODEGEN_EVIDENCE_MODE] ?? '')
    .trim()
    .toLowerCase();
  if (
    v === 'png' ||
    v === 'png-leading' ||
    v === 'screenshots' ||
    v === 'screenshot'
  ) {
    return 'png';
  }
  return 'html';
}

/**
 * Whether multimodal evidence includes viewport PNG crops.
 * Derived only from {@link resolveCodegenEvidenceMode} (`png` → true).
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function resolveCodegenAttachScreenshots(env = process.env) {
  return resolveCodegenEvidenceMode(env) === 'png';
}

/** Max molecule nesting depth for codegen (section → child → grandchild). */
export const BQ_CODEGEN_MAX_DEPTH = 'BQ_CODEGEN_MAX_DEPTH';

/**
 * When `1` (default), AI may invent Tailwind breakpoints if evidence
 * lacks usable multi-viewport treatment. `0` = mimic evidence only.
 */
export const BQ_CODEGEN_INFER_RESPONSIVE = 'BQ_CODEGEN_INFER_RESPONSIVE';

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function resolveCodegenMaxDepth(env = process.env) {
  const n = Number(env?.[BQ_CODEGEN_MAX_DEPTH]);
  if (Number.isFinite(n) && n >= 1 && n <= 4) return Math.trunc(n);
  return 2;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function resolveCodegenInferResponsive(env = process.env) {
  const v = String(env?.[BQ_CODEGEN_INFER_RESPONSIVE] ?? '1')
    .trim()
    .toLowerCase();
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return true;
}

/** Navigation packageKind reference (consolidated, frozen). */
export const CODEGEN_V2_NAV_REFERENCE_RELS = [
  'references/Navigation.reference.tsx',
];

/** Default / universal field-catalog reference for codegen v2. */
export const CODEGEN_V2_DEFAULT_REFERENCE_REL = FIELD_CATALOG_REFERENCE_REL;

/** Sitecore AI reference widths for evidence labels. */
const VIEWPORT_CROP_LABELS = {
  desktop:
    'Desktop Small 1024px — typically lg: (≥1024); match section.html + this crop',
  desktopRegular:
    'Desktop Regular 1280px — typically xl: when HTML/crop differ from 1024; match evidence',
  desktopLarge:
    'Desktop Large 1536px — typically 2xl: when HTML/crop differ from 1280; match evidence',
  tablet: 'tablet 768–1023 (crop 768px) — md: when HTML/crop use it',
  mobile: 'mobile <768 (crop ~370px)',
};

/**
 * Allow scrollbar / clip shrinkage vs VIEWPORTS width when validating crop PNGs.
 * Mobile 370→~340 and tablet 768→~738 are normal for viewport-clip captures.
 */
const VIEWPORT_WIDTH_TOLERANCE_PX = 50;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, 'prompts');
/** Cap for page-shared design prefix (identical across section calls for Azure prompt cache). */
export const SHARED_DESIGN_PREFIX_MAX_CHARS = 24000;

async function loadPrompt(name) {
  return readFile(path.join(PROMPTS_DIR, name), 'utf8');
}

/** Placeholder in system-*.md stack context lines. */
export const CONTENT_SDK_VERSION_PLACEHOLDER = '{{CONTENT_SDK_VERSION}}';

/**
 * Installed or declared `@sitecore-content-sdk/nextjs` version for prompts.
 * Prefer node_modules package.json; fall back to bq/package.json dependency range
 * (leading ^/~ stripped for display).
 *
 * @param {string} [rootDir] — bq package root (default {@link bqRoot})
 * @returns {Promise<string>}
 */
export async function resolveContentSdkNextjsVersion(rootDir = bqRoot) {
  const pkgName = '@sitecore-content-sdk/nextjs';
  try {
    const installed = JSON.parse(
      await readFile(
        path.join(rootDir, 'node_modules', pkgName, 'package.json'),
        'utf8',
      ),
    );
    const v = String(installed?.version || '').trim();
    if (v) return v;
  } catch {
    /* fall through */
  }
  try {
    const pkg = JSON.parse(
      await readFile(path.join(rootDir, 'package.json'), 'utf8'),
    );
    const raw =
      pkg?.dependencies?.[pkgName] ||
      pkg?.devDependencies?.[pkgName] ||
      '';
    const v = String(raw).trim().replace(/^[~^]/, '');
    if (v) return v;
  } catch {
    /* fall through */
  }
  return 'unknown';
}

/**
 * Replace {{CONTENT_SDK_VERSION}} in loaded system prompt markdown.
 * @param {string} text
 * @param {string} [version]
 */
export function applyContentSdkVersionToPrompt(text, version) {
  const ver = String(version || 'unknown').trim() || 'unknown';
  return String(text || '').split(CONTENT_SDK_VERSION_PLACEHOLDER).join(ver);
}

/**
 * Resolve BQ_UI_ICON_LIBRARY for codegen prompts.
 * Unset / empty / unknown → `fa` (Font Awesome). Aliases: fontawesome, font-awesome → fa.
 * @returns {'fa'|'lucide'}
 */
export function resolveUiIconLibrary(env = process.env) {
  const raw = String(env?.BQ_UI_ICON_LIBRARY ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return 'fa';
  if (raw === 'lucide') return 'lucide';
  if (raw === 'fa' || raw === 'fontawesome' || raw === 'font-awesome') return 'fa';
  return 'fa';
}

/**
 * Short prompt block for UI icon library preference (social brands always FaIcon).
 * @param {'fa'|'lucide'} [library]
 */
export function formatUiIconLibraryForPrompt(library = resolveUiIconLibrary()) {
  const iconCaseHard =
    'HARD: Icon Single-Line Text / bag `icon` seeds are lowercase kebab only (`account`, `facebook` — never `Account` / `Facebook`). Custom icon-kind switches must compare lowercase literals and read `(fields.Icon?.value || \'\').toLowerCase()` (or `String(row.icon||\'\').toLowerCase()`).';
  if (library === 'lucide') {
    return [
      '=== UI ICON LIBRARY (BQ_UI_ICON_LIBRARY=lucide) ===',
      'HARD — generic UI chrome icons (ChevronDown, ChevronRight, Menu, Search, User, X, arrows, hamburger): import ONLY from `lucide-react` — e.g. `import { ChevronDown, Menu } from \'lucide-react\'`.',
      'HARD — NEVER put Lucide / UI glyph names on `@sitecore-content-sdk/nextjs`. SDK value imports are ONLY Text, RichText, Image, Link, AppPlaceholder, Placeholder, NextImage, useSitecore (plus `import type` for TextField / RichTextField / ImageField / LinkField / Field).',
      'HARD — NEVER import Field / TextField / RichTextField / ImageField / LinkField from `lib/component-props` (TS2459). Use `import type { Field, … } from \'@sitecore-content-sdk/nextjs\'` + `import type { ComponentWithContextProps } from \'lib/component-props\'`.',
      'Forbidden: `import { ChevronDown, Text } from \'@sitecore-content-sdk/nextjs\'` / `import { Menu, Search, User, X, Link } from \'@sitecore-content-sdk/nextjs\'`.',
      'Correct: `import { Text, Link, Image } from \'@sitecore-content-sdk/nextjs\';` + separate `import { ChevronDown, Menu, Search, User, X } from \'lucide-react\';`.',
      'HARD: social / Icon Link List brand glyphs ALWAYS use `import { FaIcon } from \'components/icons/fa-icon\'` with `name={…}` + `faStyle="brands"` — never Lucide for facebook/instagram/etc. Forbidden FaIcon props: faIcon, iconName, icon.',
      iconCaseHard,
    ].join('\n');
  }
  return [
    '=== UI ICON LIBRARY (BQ_UI_ICON_LIBRARY=fa, default) ===',
    'Generic UI chrome: Font Awesome / decorative text (`→`) as in HARD rules below.',
    'HARD — NEVER import Field / TextField / RichTextField / ImageField / LinkField from `lib/component-props` (TS2459). Use `import type { Field, … } from \'@sitecore-content-sdk/nextjs\'` + `import type { ComponentWithContextProps } from \'lib/component-props\'`.',
    'HARD: social / Icon Link List brand glyphs use `import { FaIcon } from \'components/icons/fa-icon\'` with `name={…}` + faStyle (never faIcon/iconName/icon props).',
    iconCaseHard,
  ].join('\n');
}

/**
 * Thin shared prefix for codegen v2 — identity only (no ai-derived-design / content-families).
 *
 * @param {{
 *   collectionSystem?: string,
 *   hostSlug?: string,
 *   siteUrl?: string,
 * }} opts
 * @returns {string}
 */
export function buildPageSharedDesignPrefixV2(opts = {}) {
  const lines = [
    '=== PAGE SHARED CONTEXT (codegen v2 — identity only; no design md) ===',
    `collectionSystem: ${opts.collectionSystem || ''}`,
    `hostSlug: ${opts.hostSlug || ''}`,
  ];
  if (opts.siteUrl) lines.push(`siteUrl: ${opts.siteUrl}`);
  lines.push('=== END PAGE SHARED CONTEXT ===');
  return lines.join('\n');
}

/**
 * Embed frozen reference sources for codegen v2.
 * Always attaches FieldCatalog; adds matching component-type references.
 * Patterns only — styling must come from HTML/PNG evidence.
 *
 * @param {string|{
 *   packageKind?: string,
 *   layoutPattern?: string,
 *   cmsName?: string,
 *   componentName?: string,
 *   purpose?: string,
 *   role?: string,
 *   pageRole?: string,
 *   referenceTypeKeys?: string[],
 * }} packageKindOrOpts
 * @returns {Promise<string>}
 */
export async function formatCodegenReferenceExamplesForPrompt(packageKindOrOpts) {
  const opts =
    typeof packageKindOrOpts === 'string' || packageKindOrOpts == null
      ? { packageKind: packageKindOrOpts || 'default' }
      : packageKindOrOpts;
  const packageKind = opts.packageKind === 'navigation' ? 'navigation' : 'default';
  const rels = resolveReferenceRelsForCodegen({
    ...opts,
    packageKind,
    referenceTypeKeys: opts.referenceTypeKeys,
  });
  const typeNote =
    packageKind === 'navigation'
      ? 'packageKind=navigation — use Navigation.reference.tsx for resolver Fields (Record<string, NavItemFields>).'
      : 'Matched component-type references (plus FieldCatalog) for field / placeholder / import patterns.';
  const intro = [
    '=== REFERENCE EXAMPLES (codegen v2) ===',
    typeNote,
    'REFERENCE ONLY — copy field/placeholder/import patterns; do not copy missing styles from references (references are intentionally unstyled); match visual styling from capture evidence.',
    'HARD: Do NOT copy Tailwind/CSS classNames or presentational styling from these references.',
    'HARD: Rebuild all visual styling from the section evidence (HTML and/or screenshots) in the evidence message.',
    'HARD: Checkbox model type → Field<boolean> inline. Never import or declare CheckboxField.',
    '',
  ];
  /** @type {string[]} */
  const bodies = [];
  for (const rel of rels) {
    try {
      const text = (await loadPrompt(rel)).trim();
      if (!text) continue;
      const fence = rel.endsWith('.ts') ? 'ts' : 'tsx';
      bodies.push(`### ${rel}\n\`\`\`${fence}\n${text}\n\`\`\``);
    } catch {
      bodies.push(`### ${rel}\n(missing — skip)`);
    }
  }
  return [...intro, ...bodies, '=== END REFERENCE EXAMPLES ==='].join('\n');
}

/**
 * Multimodal screenshot→TSX model.
 * Loads bq/.env + .env.local first (must run before azureChatCompletion arg eval).
 * Falls back to AZURE_OPENAI_DEFAULT_MODEL when SCREENSHOT unset.
 */
export function screenshotConversionModel() {
  loadLocalEnvFiles({ root: bqRoot });
  const screenshot = (process.env.AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL || '').trim();
  if (screenshot) return screenshot;
  const fallback = (process.env.AZURE_OPENAI_DEFAULT_MODEL || '').trim();
  return fallback || undefined;
}

/**
 * Prefer original-section.html for structural identity / wiring (root ids).
 * Falls back to styled section.html / legacy siblings when original is missing.
 * Not used for AI DOM+CSS packing — see loadSectionHtmlForAiEvidence.
 *
 * @param {string} pageDir
 * @param {string} sectionFolder
 * @param {object} info
 * @returns {Promise<{ html: string, label: string, absPath: string|null }>}
 */
export async function loadPreferredSectionHtml(pageDir, sectionFolder, info) {
  const sectionDir = path.join(pageDir, 'sections', sectionFolder);
  const originalAbs = path.join(sectionDir, ORIGINAL_SECTION_HTML);
  try {
    const html = await readFile(originalAbs, 'utf8');
    if (html.trim()) {
      return { html, label: ORIGINAL_SECTION_HTML, absPath: originalAbs };
    }
  } catch {
    /* try styled fallbacks */
  }

  const candidates = [
    { file: SECTION_HTML, label: SECTION_HTML },
    { file: 'section.styled-desktop.html', label: 'section.styled-desktop.html' },
    { file: 'section.styled.html', label: 'section.styled.html' },
    { file: 'section.styled-tablet.html', label: 'section.styled-tablet.html' },
    { file: 'section.styled-mobile.html', label: 'section.styled-mobile.html' },
  ];
  for (const c of candidates) {
    const abs = path.join(sectionDir, c.file);
    try {
      const html = await readFile(abs, 'utf8');
      if (html.trim()) return { html, label: c.label, absPath: abs };
    } catch {
      /* try next */
    }
  }
  const fallbackRel = info?.sectionHtml || `sections/${sectionFolder}/section.html`;
  const fallbackAbs = path.join(pageDir, fallbackRel);
  try {
    const html = await readFile(fallbackAbs, 'utf8');
    return { html, label: 'section.html', absPath: fallbackAbs };
  } catch {
    return { html: '', label: 'section.html', absPath: null };
  }
}

/** Styled / legacy section.html candidates for AI packing (html evidence mode). */
const AI_STYLED_SECTION_HTML_CANDIDATES = [
  { file: SECTION_HTML, label: SECTION_HTML },
  { file: 'section.styled-desktop.html', label: 'section.styled-desktop.html' },
  { file: 'section.styled.html', label: 'section.styled.html' },
  { file: 'section.styled-tablet.html', label: 'section.styled-tablet.html' },
  { file: 'section.styled-mobile.html', label: 'section.styled-mobile.html' },
];

/** Original / structural HTML candidates for AI packing (png evidence mode). */
const AI_ORIGINAL_SECTION_HTML_CANDIDATES = [
  { file: ORIGINAL_SECTION_HTML, label: ORIGINAL_SECTION_HTML },
  { file: SECTION_HTML, label: SECTION_HTML },
];

/**
 * Load section HTML for AI packing based on {@link resolveCodegenEvidenceMode}.
 * - `html`: CSS-inlined section.html (styled)
 * - `png`: original-section.html (raw structure; screenshots carry visuals)
 *
 * @param {string} pageDir
 * @param {string} sectionFolder
 * @param {object} [info]
 * @param {{ evidenceMode?: 'html'|'png' }} [opts]
 * @returns {Promise<{ html: string, label: string, absPath: string|null }>}
 */
export async function loadSectionHtmlForAiEvidence(
  pageDir,
  sectionFolder,
  info,
  opts = {},
) {
  const mode = opts.evidenceMode ?? resolveCodegenEvidenceMode();
  const sectionDir = path.join(pageDir, 'sections', sectionFolder);
  const candidates =
    mode === 'png'
      ? AI_ORIGINAL_SECTION_HTML_CANDIDATES
      : AI_STYLED_SECTION_HTML_CANDIDATES;

  for (const c of candidates) {
    const abs = path.join(sectionDir, c.file);
    try {
      const html = await readFile(abs, 'utf8');
      if (html.trim()) return { html, label: c.label, absPath: abs };
    } catch {
      /* try next */
    }
  }

  // html mode: if styled missing, fall back to original; png mode already tried section.html
  if (mode === 'html') {
    const originalAbs = path.join(sectionDir, ORIGINAL_SECTION_HTML);
    try {
      const html = await readFile(originalAbs, 'utf8');
      if (html.trim()) {
        return { html, label: ORIGINAL_SECTION_HTML, absPath: originalAbs };
      }
    } catch {
      /* continue */
    }
  }

  const fallbackRel = info?.sectionHtml;
  if (fallbackRel) {
    const fallbackAbs = path.join(pageDir, fallbackRel);
    const base = path.basename(fallbackRel).toLowerCase();
    // html mode: skip original unless nothing else worked (already tried above)
    if (mode === 'png' || base !== ORIGINAL_SECTION_HTML.toLowerCase()) {
      try {
        const html = await readFile(fallbackAbs, 'utf8');
        if (html.trim()) {
          return { html, label: path.basename(fallbackRel), absPath: fallbackAbs };
        }
      } catch {
        /* empty below */
      }
    }
  }
  return {
    html: '',
    label: mode === 'png' ? ORIGINAL_SECTION_HTML : SECTION_HTML,
    absPath: null,
  };
}

/**
 * Legacy soft cap (tests / explicit truncate only).
 * Default packing sends **full** section.html (no truncate) — see formatSectionAiHtmlAndCss.
 */
export const AI_SECTION_HTML_MAX_CHARS = 68_000;
/** @deprecated Combined into AI_SECTION_HTML_MAX_CHARS; kept for callers. */
export const AI_SECTION_CSS_MAX_CHARS = 0;
/** @deprecated Prefer full HTML; kept for callers that still pass htmlMax. */
export const AI_DECOMPOSE_HTML_MAX_CHARS = 68_000;

/** Short identical system stub so section evidence can sit in a stable prompt-cache prefix. */
export const SHARED_SYSTEM_STUB =
  'You convert captured website sections into Sitecore Content SDK components for BQ (Next.js App Router). Follow the task message exactly. Return valid JSON only when the task requests JSON.';

/**
 * Load section.html for AI packing (decompose + codegen).
 *
 * @param {string} pageDir
 * @param {string} sectionFolder
 * @param {object} info
 * @returns {Promise<{
 *   html: string,
 *   htmlLabel: string,
 *   absPath: string|null,
 * }>}
 */
export async function loadSectionAiEvidence(pageDir, sectionFolder, info) {
  const { html, label: htmlLabel, absPath } = await loadSectionHtmlForAiEvidence(
    pageDir,
    sectionFolder,
    info,
  );
  return { html, htmlLabel, absPath };
}

/**
 * Format section.html (DOM + embedded styles) for the multimodal user message.
 * By default sends **full** HTML (no truncate). Pass `htmlMax` to force a cap.
 *
 * @param {{ html: string, htmlLabel?: string }} evidence
 * @param {{ htmlMax?: number|null }} [caps]
 * @returns {string}
 */
export function formatSectionAiHtmlAndCss(evidence, caps = {}) {
  // null/undefined htmlMax ⇒ no truncate (full document)
  const htmlMax =
    caps.htmlMax === undefined || caps.htmlMax === null
      ? null
      : Number(caps.htmlMax);
  const html = String(evidence.html || '');
  const label = evidence.htmlLabel || SECTION_HTML;
  const isOriginal =
    String(label).toLowerCase() === ORIGINAL_SECTION_HTML.toLowerCase();
  let body = html;
  if (html && htmlMax != null && Number.isFinite(htmlMax) && html.length > htmlMax) {
    body = `${html.slice(0, htmlMax)}\n…[truncated ${html.length - htmlMax} chars]`;
  }
  if (isOriginal) {
    return [
      `=== SECTION EVIDENCE (${label} — raw DOM structure, no inlined CSS) ===`,
      'PRIMARY (structure + content wiring):',
      '- DOM structure, repeating units (carousel/grid/footer siblings; off-screen slides).',
      '- hrefs, image src/alt URLs, copy, aria.',
      'VISUAL (viewport screenshots in this message): layout spacing, color, type hierarchy, and styling — screenshots lead; HTML wires content.',
      'Do NOT copy capture class lists into TSX. Rebuild Tailwind from HTML structure + screenshot confirmation.',
      'Skip utilities not visible in the resting crops (e.g. outline-indigo / focus-only rings).',
      body
        ? body
        : '(original-section.html missing — rely on screenshots + design prefix; do not invent layout from memory)',
      `=== END SECTION EVIDENCE ===`,
    ].join('\n');
  }
  return [
    `=== SECTION EVIDENCE (${label} — DOM + embedded styles) ===`,
    'PRIMARY (structure + content wiring + visual CSS):',
    '- DOM structure, repeating units (carousel/grid/footer siblings; off-screen slides).',
    '- hrefs, image src/alt URLs, copy, aria, brand tokens / fonts / CSS.',
    'Screenshots are not attached in html evidence mode — do not invent crop pixels.',
    'Do NOT copy capture class lists into TSX. Rebuild Tailwind from HTML/CSS structure.',
    'Skip utilities not visible in the resting HTML/CSS (e.g. outline-indigo / focus-only rings).',
    body
      ? body
      : '(section.html missing — rely on design prefix + section-information.json; do not invent layout from memory)',
    `=== END SECTION EVIDENCE ===`,
  ].join('\n');
}

/**
 * Byte-identical evidence message for one section (HTML + optional viewport screenshots).
 * Reuse across decompose + codegen (+ children) for prompt-cache hits.
 *
 * @param {{
 *   aiEvidence: { html: string, htmlLabel?: string },
 *   evidenceParts: object[],
 *   attachScreenshots?: boolean,
 * }} opts
 * @returns {{ role: 'user', content: object[] }}
 */
export function buildSectionEvidenceMessage({
  aiEvidence,
  evidenceParts,
  attachScreenshots,
  info = null,
}) {
  const parts = Array.isArray(evidenceParts)
    ? evidenceParts
    : Array.isArray(evidenceParts?.parts)
      ? evidenceParts.parts
      : [];
  const hasImageParts = parts.some(
    (p) =>
      p &&
      typeof p === 'object' &&
      (p.type === 'image_url' ||
        p.type === 'image' ||
        p.image_url ||
        p.image),
  );
  const attach =
    attachScreenshots != null
      ? Boolean(attachScreenshots)
      : hasImageParts || resolveCodegenAttachScreenshots();
  const framing = attach
    ? 'PRIMARY (BQ_CODEGEN_EVIDENCE_MODE=png): original-section.html (structure, hrefs, image URLs, copy) + Sitecore AI crops (Desktop Small/Regular/Large → tablet → mobile when present; open-state shots when present). Screenshots lead visuals; HTML wires content.'
    : 'PRIMARY (BQ_CODEGEN_EVIDENCE_MODE=html): FULL section.html (CSS inlined) + section-information.json (structure, hrefs, image URLs, copy, layout). Screenshots are NOT attached — do not invent crop pixels; use HTML/CSS and layout metadata.';
  const interactionBlock = formatInteractionContractForPrompt(info);
  const textPart = {
    type: 'text',
    text: [
      '=== SECTION MULTIMODAL EVIDENCE (identical on decompose + codegen for this section) ===',
      framing,
      interactionBlock,
      formatSectionAiHtmlAndCss(aiEvidence || { html: '' }),
    ]
      .filter(Boolean)
      .join('\n'),
  };
  return {
    role: 'user',
    content: [textPart, ...parts],
  };
}

/**
 * @returns {{ role: 'system', content: string }}
 */
export function sharedSystemStubMessage() {
  return { role: 'system', content: SHARED_SYSTEM_STUB };
}

/**
 * Load evidence once per section for reuse across Azure calls.
 * @param {string} pageDir
 * @param {string} sectionFolder
 * @param {object} info
 */
export async function loadSectionEvidenceBundle(pageDir, sectionFolder, info) {
  const aiEvidence = await loadSectionAiEvidence(pageDir, sectionFolder, info);
  const built = await buildSectionEvidenceParts(pageDir, sectionFolder, info);
  const {
    parts: evidenceParts,
    attachments: evidenceAttachments,
    imageRelsInOrder: evidenceImageRelsInOrder,
    attachScreenshots,
  } = built;
  const sectionEvidenceMessage = buildSectionEvidenceMessage({
    aiEvidence,
    evidenceParts,
    attachScreenshots,
    info,
  });
  return {
    aiEvidence,
    evidenceParts,
    evidenceAttachments,
    evidenceImageRelsInOrder,
    attachScreenshots,
    sectionEvidenceMessage,
  };
}

/**
 * @param {string} sharedDesignPrefix
 * @returns {{ role: 'user', content: string }}
 */
export function sharedDesignPrefixMessage(sharedDesignPrefix) {
  return {
    role: 'user',
    content: String(sharedDesignPrefix || '').trim() || '(no shared design context)',
  };
}

/**
 * Read PNG/JPEG width via sharp (for viewport evidence sanity checks).
 * @param {string} absPath
 * @returns {Promise<number|null>}
 */
export async function readImageWidthPx(absPath) {
  try {
    const meta = await sharp(absPath).metadata();
    const w = Number(meta?.width);
    return Number.isFinite(w) && w > 0 ? w : null;
  } catch {
    return null;
  }
}

/** Consent/CMP naming — dialog crops are often ~500–600px, not full viewport. */
const CONSENT_OVERLAY_EVIDENCE_RE =
  /cookie|consent|onetrust|cmp|didomi|osano|cookiebot|gdpr|privacy.?banner|trustcommander|usercentrics/i;

/**
 * True when section evidence is a consent/CMP dialog (narrow crop width expected).
 * @param {object|null|undefined} info
 */
export function isConsentOverlayEvidence(info) {
  if (!info || typeof info !== 'object') return false;
  const role = String(
    info.role || info.pageWiring?.role || info.enrichRole || '',
  )
    .trim()
    .toLowerCase();
  if (role === 'partial-cookie') return true;

  const blob = [
    info.cmsName,
    info.folderName,
    info.purpose,
    info.chromeKind,
    info.type,
    info.selector,
    info.track,
    ...(Array.isArray(info.reasons) ? info.reasons : []),
  ]
    .filter(Boolean)
    .join(' ');
  // Name/purpose/folder (consent-banner, cookie) or overlay+CMP wording.
  return CONSENT_OVERLAY_EVIDENCE_RE.test(blob);
}

/**
 * Warn when a labeled viewport crop's pixel width does not match VIEWPORTS
 * (catches swapped tablet/mobile files before they hit Azure).
 * Skips consent/CMP dialogs — crops are the dialog box, not full viewport width.
 * @param {string} viewportKey
 * @param {string} absPath
 * @param {string} relPath
 * @param {object|null|undefined} [info] section-information (optional)
 */
export async function warnIfViewportCropWidthMismatch(
  viewportKey,
  absPath,
  relPath,
  info,
) {
  if (isConsentOverlayEvidence(info)) return;
  const expected = VIEWPORTS[viewportKey]?.width;
  if (!expected) return;
  const width = await readImageWidthPx(absPath);
  if (width == null) return;
  // Tiny / stub PNGs (unit fixtures) — skip noise.
  if (width < 64) return;
  if (Math.abs(width - expected) <= VIEWPORT_WIDTH_TOLERANCE_PX) return;
  // Prefer warning when the file looks like a *different* Sitecore AI viewport
  // (classic tablet↔mobile swap), not arbitrary resize.
  let closestKey = viewportKey;
  let closestDist = Math.abs(width - expected);
  for (const [key, spec] of Object.entries(VIEWPORTS)) {
    const d = Math.abs(width - spec.width);
    if (d < closestDist) {
      closestDist = d;
      closestKey = key;
    }
  }
  const hint =
    closestKey !== viewportKey &&
    closestDist <= VIEWPORT_WIDTH_TOLERANCE_PX
      ? ` — file looks like ${closestKey} (~${VIEWPORTS[closestKey].width}px)`
      : '';
  console.warn(
    `  ⚠ Evidence crop width mismatch: label=${viewportKey} expected~${expected}px ` +
      `got ${width}px file=${relPath}${hint} (possible tablet/mobile swap)`,
  );
}

/**
 * @param {string} absPath
 * @param {string} [relPath] stamped on the part for ai-debug dumps only
 *   (stripped before Azure if present — prefer imageRelsInOrder for dumps)
 */
async function loadImagePart(absPath, relPath = '') {
  try {
    const buf = await readFile(absPath);
    if (!buf.length) return null;
    const part = imageContentPart(buf, 'image/png');
    const rel = String(relPath || '')
      .replace(/\\/g, '/')
      .trim();
    // Non-enumerable so JSON.stringify for Azure omits it; dumps still read it.
    if (rel) {
      Object.defineProperty(part, '_bqRelPath', {
        value: rel,
        enumerable: false,
        configurable: true,
      });
    }
    return part;
  } catch {
    return null;
  }
}

const INTERACTION_STATE_KINDS = new Set(['menu', 'tab', 'accordion']);

/**
 * Usable interaction states for multi-state codegen (menu / tab / accordion).
 * @param {object|null|undefined} info
 * @returns {object[]}
 */
export function listInteractiveStates(info) {
  const states = Array.isArray(info?.interactionStates)
    ? info.interactionStates
    : [];
  return states.filter((st) =>
    INTERACTION_STATE_KINDS.has(String(st?.kind || '').toLowerCase()),
  );
}

/**
 * Derive exclusive peer-selection behavior from capture evidence only.
 * Restates notes / tab|accordion states in behavioral terms — no React API recipes.
 * @param {object|null|undefined} info
 * @returns {string[]}
 */
export function deriveExclusivePeerSelectionFromEvidence(info) {
  const notes = String(
    info?.layout?.interactionNotes ||
      info?.interactionNotes ||
      info?.layout?.structureNotes ||
      '',
  )
    .trim()
    .toLowerCase();
  const states = listInteractiveStates(info);
  const tabStates = states.filter(
    (st) => String(st?.kind || '').toLowerCase() === 'tab',
  );
  const accordionStates = states.filter(
    (st) => String(st?.kind || '').toLowerCase() === 'accordion',
  );

  const notesExclusive =
    /only the selected|selected (?:story|item|panel|tab) is expanded|changes the active|active (?:story|panel|item|tab)|one (?:story|panel|item) (?:at a time|expanded)|swap(?:s|ping)? (?:the )?(?:media|panel|story)|mutually exclusive/.test(
      notes,
    );
  const notesAccordionExclusive =
    /accordion/.test(notes) &&
    /only the selected|one .+ expanded|expanded/.test(notes);

  /** Distinct peer labels from tab/accordion states (evidence). */
  const peerLabels = [...tabStates, ...accordionStates]
    .map((st) => String(st.label || st.slug || '').trim())
    .filter(Boolean);
  const uniquePeers = [...new Set(peerLabels)];
  const multiTabPeers = tabStates.length >= 2;
  const multiAccordionPeers = accordionStates.length >= 2;

  /** Supporting HTML cue — peers look like alternatives, not a mandate for APIs. */
  const html = String(info?.sectionHtmlInline || info?._sectionHtmlSnippet || '');
  const htmlTabAlternatives =
    /\brole\s*=\s*["']tablist["']/i.test(html) &&
    /\brole\s*=\s*["']tabpanel["']/i.test(html);

  if (
    !notesExclusive &&
    !notesAccordionExclusive &&
    !multiTabPeers &&
    !(multiAccordionPeers && notesAccordionExclusive) &&
    !(htmlTabAlternatives && multiTabPeers)
  ) {
    return [];
  }

  /** @type {string[]} */
  const out = [];
  out.push(
    'BEHAVIOR FROM EVIDENCE (exclusive peer selection — match notes/states; do not invent a different interaction model):',
  );

  if (notesExclusive || notesAccordionExclusive) {
    out.push(
      `- interactionNotes describe exclusive selection among peers (restating capture): implement so only one peer is active/expanded at a time; selecting another peer deactivates the previous — as the notes require.`,
    );
  }

  if (multiTabPeers || (htmlTabAlternatives && tabStates.length >= 1)) {
    const n = Math.max(tabStates.length, uniquePeers.length);
    const labelHint =
      uniquePeers.length >= 2
        ? ` labeled roughly: ${uniquePeers
            .slice(0, 8)
            .map((l) => JSON.stringify(l))
            .join(', ')}${uniquePeers.length > 8 ? ', …' : ''}`
        : '';
    out.push(
      `- ${n} kind=tab state(s) with distinct peers${labelHint}: treat as ${n} exclusive alternatives — resting shows one active peer; each tab state shows that peer’s content active. Do not show all peer media/panels at once unless notes/HTML say otherwise.`,
    );
  }

  if (multiAccordionPeers && (notesAccordionExclusive || notesExclusive)) {
    out.push(
      `- accordion states + notes: only one accordion peer expanded at a time (match “only the selected …” wording in notes).`,
    );
  }

  return out;
}

/**
 * Compact HARD interaction contract from layout.interactionNotes + interactionStates.
 * Empty when neither usable states nor meaningful notes exist.
 * @param {object|null|undefined} info
 * @returns {string}
 */
export function formatInteractionContractForPrompt(info) {
  const notes = String(info?.layout?.interactionNotes || '').trim();
  const states = listInteractiveStates(info);
  if (!states.length && !notes) return '';

  /** @type {string[]} */
  const lines = [
    '=== INTERACTION CONTRACT (HARD — from section-information) ===',
  ];
  if (notes) {
    lines.push(`layout.interactionNotes: ${notes}`);
  }
  const exclusiveLines = deriveExclusivePeerSelectionFromEvidence(info);
  if (exclusiveLines.length) {
    lines.push(...exclusiveLines);
  }
  if (states.length) {
    lines.push(
      `interactionStates (${states.length}): implement closed (resting crops) + open (state HTML/PNGs). clientTsx REQUIRED.`,
    );
    for (const st of states) {
      const kind = String(st.kind || '').toLowerCase();
      const slug = String(st.slug || st.label || kind || 'state').trim();
      const label = String(st.label || slug).trim();
      const narrowOnly = Boolean(st.narrowOnly);
      const triggerSel = st.trigger?.selector
        ? String(st.trigger.selector)
        : '(none)';
      const triggerMethod = st.trigger?.method
        ? String(st.trigger.method)
        : 'click';
      const panelSel = st.panel?.selector
        ? String(st.panel.selector)
        : '(none)';
      const vps = ['mobile', 'tablet', 'desktop']
        .filter((vp) => st.outputs?.[vp]?.path)
        .join(',');
      lines.push(
        `- kind=${kind} slug=${slug} label=${JSON.stringify(label)} narrowOnly=${narrowOnly} trigger=${triggerSel} (${triggerMethod}) panel=${panelSel} shots=${vps || '(html-only)'}`,
      );
    }
    lines.push(
      'RULES (HARD): Toggle must actually reveal the open UI (not decorative). Open panel must be visible under the trigger (positioned containing block on chrome root when panel is absolute; do not clip with overflow-hidden). Honor narrowOnly (e.g. drawer/panel lg:hidden). Resting crops = closed/default; state shots/HTML = open. When BEHAVIOR FROM EVIDENCE above applies, that exclusive-selection behavior is part of this contract.',
    );
  } else if (notes) {
    lines.push(
      'RULES (HARD): When notes describe expandable/toggle UI, emit working client interactivity (clientTsx / hooks) matching those behaviors.',
    );
  }
  lines.push('=== END INTERACTION CONTRACT ===');
  return lines.join('\n');
}

/**
 * Recursively collect PNG paths under a directory (relative to pageDir).
 * @param {string} absDir
 * @param {string} pageDir
 * @returns {Promise<string[]>}
 */
async function listPngsUnder(absDir, pageDir) {
  /** @type {string[]} */
  const out = [];
  async function walk(dir) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (/\.png$/i.test(ent.name)) {
        out.push(path.relative(pageDir, full).replace(/\\/g, '/'));
      }
    }
  }
  await walk(absDir);
  return out.sort();
}

/**
 * Collect multimodal parts for a section (default crops + menu/tab/accordion states + any states/ PNGs).
 * PNG attach follows {@link resolveCodegenEvidenceMode} (`png`) unless `opts.attachScreenshots` is set.
 *
 * @param {string} pageDir
 * @param {string} sectionFolder
 * @param {object} info
 * @param {{ attachScreenshots?: boolean }} [opts]
 * @returns {Promise<{ parts: object[], attachments: string[], imageRelsInOrder: string[], attachScreenshots: boolean }>}
 */
export async function buildSectionEvidenceParts(
  pageDir,
  sectionFolder,
  info,
  opts = {},
) {
  const attachScreenshots =
    opts.attachScreenshots != null
      ? Boolean(opts.attachScreenshots)
      : resolveCodegenAttachScreenshots();
  const parts = [];
  /** @type {Set<string>} */
  const attachedRels = new Set();
  /** Image paths in the same order image parts are pushed (unsorted). */
  /** @type {string[]} */
  const imageRelsInOrder = [];
  const outputs = info?.outputs || {};
  const evidenceViewports = resolveEvidenceViewportOrder();

  // Always include open-state HTML when present; PNGs only when attachScreenshots.
  const states = info?.interactionStates || [];
  for (const st of states) {
    if (st.kind !== 'menu' && st.kind !== 'tab' && st.kind !== 'accordion') continue;
    const htmlRel = st.sectionHtml || st.panel?.htmlPath;
    if (!htmlRel) continue;
    try {
      const html = await readFile(path.join(pageDir, htmlRel), 'utf8');
      parts.push({
        type: 'text',
        text: `Open state HTML (${st.slug}, depth=${st.depth}, label=${st.label}):\n${html}`,
      });
      attachedRels.add(String(htmlRel).replace(/\\/g, '/'));
    } catch {
      /* skip */
    }
  }

  if (!attachScreenshots) {
    return {
      parts,
      attachments: [...attachedRels].sort(),
      imageRelsInOrder,
      attachScreenshots: false,
    };
  }

  for (const vp of evidenceViewports) {
    const rel = outputs[vp]?.path;
    if (!rel) continue;
    const norm = String(rel).replace(/\\/g, '/');
    const abs = path.join(pageDir, rel);
    await warnIfViewportCropWidthMismatch(vp, abs, norm, info);
    const img = await loadImagePart(abs, norm);
    if (img) {
      parts.push({
        type: 'text',
        text: `Screenshot (${vp}) — ${VIEWPORT_CROP_LABELS[vp] || vp}:`,
      });
      parts.push(img);
      attachedRels.add(norm);
      imageRelsInOrder.push(norm);
    }
  }

  for (const st of states) {
    if (st.kind !== 'menu' && st.kind !== 'tab' && st.kind !== 'accordion') continue;
    for (const vp of evidenceViewports) {
      const rel = st.outputs?.[vp]?.path;
      if (!rel) continue;
      const norm = String(rel).replace(/\\/g, '/');
      if (attachedRels.has(norm)) continue;
      const abs = path.join(pageDir, rel);
      await warnIfViewportCropWidthMismatch(vp, abs, norm, info);
      const img = await loadImagePart(abs, norm);
      if (img) {
        parts.push({
          type: 'text',
          text: `State screenshot ${st.slug} (${vp}) — ${VIEWPORT_CROP_LABELS[vp] || vp}:`,
        });
        parts.push(img);
        attachedRels.add(norm);
        imageRelsInOrder.push(norm);
      }
    }
  }

  // Attach any remaining PNGs under states/ and statesbymutation/ (covers gaps in interactionStates).
  const sectionAbs = path.join(pageDir, 'sections', sectionFolder);
  for (const sub of ['states', 'statesbymutation']) {
    const pngs = await listPngsUnder(path.join(sectionAbs, sub), pageDir);
    for (const rel of pngs) {
      if (attachedRels.has(rel)) continue;
      const img = await loadImagePart(path.join(pageDir, rel), rel);
      if (!img) continue;
      parts.push({
        type: 'text',
        text: `Additional state screenshot (${rel}):`,
      });
      parts.push(img);
      attachedRels.add(rel);
      imageRelsInOrder.push(rel);
    }
  }

  return {
    parts,
    attachments: [...attachedRels].sort(),
    imageRelsInOrder,
    attachScreenshots: true,
  };
}
