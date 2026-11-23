/**
 * Azure Foundry → ai-derived-design.md (Stitch / Design Extractor style) from page HTML+CSS.
 * Skips Azure when md + meta exist and HTML/CSS sourceHash is unchanged (unless force design).
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  getAiUsageEntry,
  writeAiUsageMeta,
} from '../../../../shared/ai-usage-meta.mjs';
import { resolveExistingPageHtml } from '../../page-layout.mjs';
import { azureChatCompletion, resolveAzureChatConfig } from './azure-chat.mjs';
import { shouldForce } from '../../force-kinds.mjs';
import { extractContentLanguageFromDesignMd } from '../../../../shared/cultures.mjs';

export const AI_DERIVED_DESIGN_MD = 'ai-derived-design.md';
/** @deprecated Skip/usage live in pageDir/ai-meta.json (purpose ai-derived-design). */
export const AI_DERIVED_DESIGN_META = 'ai-derived-design.meta.json';
export const AI_DERIVED_DESIGN_PURPOSE = 'ai-derived-design';

/** Legacy outputs deleted after a successful (or reused) design write. */
export const LEGACY_AI_DESIGN_FILES = [
  'DESIGN.md',
  'ai-derived-design-guide.json',
  'ai-design-tokens.css',
  'derived-design-guide.json',
  AI_DERIVED_DESIGN_META,
];

function stripScriptBodies(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '<script></script>')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
}

function resolveMaxPayloadChars() {
  const raw = process.env.AZURE_AI_DESIGN_MAX_CHARS?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function sha256Hex(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function extractDesignMarkdown(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();
  // Drop common chat wrappers (fences, "Here is…", JSON string payloads).
  const fenced = s.match(/```(?:markdown|md|yaml|yml)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();
  if (
    (s.startsWith('{') && s.includes('"markdown"')) ||
    (s.startsWith('{') && s.includes('"content"'))
  ) {
    try {
      const obj = JSON.parse(s);
      const inner =
        typeof obj.markdown === 'string'
          ? obj.markdown
          : typeof obj.content === 'string'
            ? obj.content
            : typeof obj.designMd === 'string'
              ? obj.designMd
              : null;
      if (inner) s = String(inner).trim();
    } catch {
      /* keep s */
    }
  }
  const fm = s.indexOf('---');
  if (fm >= 0) s = s.slice(fm).trim();
  // Require a closing front-matter fence (second ---), not merely one occurrence.
  const second = s.indexOf('---', 3);
  if (second < 0) return null;
  if (!s.endsWith('\n')) s += '\n';
  return s;
}

async function fileNonEmpty(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    return text.trim().length > 0;
  } catch {
    return false;
  }
}

async function cleanupLegacy(pageDir) {
  for (const legacy of LEGACY_AI_DESIGN_FILES) {
    try {
      await unlink(path.join(pageDir, legacy));
    } catch {
      /* none */
    }
  }
}

export async function assemblePagePayload(pageDir) {
  const included = [];
  const skipped = [];
  const parts = [];
  let used = 0;
  const maxChars = resolveMaxPayloadChars();

  const pushBlock = (label, text) => {
    const body = String(text || '');
    if (!body) {
      skipped.push({ label, reason: 'empty' });
      return;
    }
    const header = `\n\n===== ${label} =====\n`;
    const blockFull = `${header}${body}`;
    if (maxChars != null && used + blockFull.length > maxChars) {
      const room = maxChars - used - header.length;
      if (room <= 0) {
        skipped.push({ label, reason: 'budget', chars: body.length });
        return;
      }
      const slice = body.slice(0, room);
      const block = `${header}${slice}\n/* …truncated */\n`;
      parts.push(block);
      used += block.length;
      included.push({ label, chars: slice.length, truncated: true });
      return;
    }
    parts.push(blockFull);
    used += blockFull.length;
    included.push({ label, chars: body.length, truncated: false });
  };

  const htmlPath = await resolveExistingPageHtml(pageDir);
  if (htmlPath) {
    const html = stripScriptBodies(await readFile(htmlPath, 'utf8'));
    pushBlock('html/page.html', html);
  } else {
    skipped.push({ label: 'html/page.html', reason: 'missing' });
  }

  /** @type {{ file: string, score?: number, order?: number }[]} */
  let cssFiles = [];
  try {
    const detected = JSON.parse(await readFile(path.join(pageDir, 'detected-css.json'), 'utf8'));
    cssFiles = (detected.files || []).filter((f) => f.status === 'downloaded' && f.file);
  } catch {
    /* optional */
  }

  try {
    const cssDir = path.join(pageDir, 'css');
    const names = await readdir(cssDir);
    const seen = new Set(cssFiles.map((f) => f.file.replace(/\\/g, '/')));
    for (const name of names) {
      if (!/\.css$/i.test(name)) continue;
      const rel = `css/${name}`;
      if (seen.has(rel)) continue;
      cssFiles.push({ file: rel, score: 0, order: 9999 });
    }
  } catch {
    /* no css dir */
  }

  cssFiles.sort((a, b) => {
    const aInline = /page-inline\.css$/i.test(a.file) ? 1 : 0;
    const bInline = /page-inline\.css$/i.test(b.file) ? 1 : 0;
    if (aInline !== bInline) return bInline - aInline;
    return (b.score ?? 0) - (a.score ?? 0) || (a.order ?? 0) - (b.order ?? 0);
  });

  for (const file of cssFiles) {
    const rel = file.file.replace(/\\/g, '/');
    try {
      const cssText = await readFile(path.join(pageDir, rel), 'utf8');
      pushBlock(rel, cssText);
    } catch {
      skipped.push({ label: rel, reason: 'unreadable' });
    }
  }

  const payload = parts.join('');
  return {
    payload,
    sourceHash: sha256Hex(payload),
    usedChars: used,
    included,
    skipped,
    maxChars,
  };
}

/**
 * @param {string} pageDir
 * @param {{ url?: string, force?: Set<string> }} [opts]
 */
export async function generateAiDesignGuide(pageDir, opts = {}) {
  const forceDesign = shouldForce(opts.force, 'design');
  const assembled = await assemblePagePayload(pageDir);
  if (!assembled.payload.trim()) {
    const skipReason = 'no HTML/CSS payload for AI design';
    console.warn(`    … AI design skipped: ${skipReason}`);
    return { ok: false, skipReason };
  }

  const designMdPath = path.join(pageDir, AI_DERIVED_DESIGN_MD);
  const mdExists = await fileNonEmpty(designMdPath);
  const usageEntry = await getAiUsageEntry(pageDir, AI_DERIVED_DESIGN_PURPOSE);
  const priorHash = usageEntry?.context?.sourceHash || null;

  if (!forceDesign && mdExists && priorHash && priorHash === assembled.sourceHash) {
    await cleanupLegacy(pageDir);
    let contentLanguage = null;
    try {
      contentLanguage = extractContentLanguageFromDesignMd(
        await readFile(designMdPath, 'utf8'),
      );
    } catch {
      /* optional */
    }
    return {
      ok: true,
      reused: true,
      designMdPath,
      sourceHash: assembled.sourceHash,
      model: usageEntry?.model || null,
      skipReason: 'sourceHash match',
      contentLanguage,
    };
  }

  const regenReason = forceDesign
    ? 'forced'
    : !mdExists
      ? 'missing'
      : !priorHash
        ? 'meta missing'
        : 'hash mismatch';
  console.log(`    … AI design: regenerating (${regenReason})`);

  const config = resolveAzureChatConfig();
  if (!config.ok) {
    console.warn(`    … AI design skipped: ${config.skipReason}`);
    return { ok: false, skipReason: config.skipReason };
  }

  console.log(
    `    … AI design input: ${assembled.included.length} block(s), ${assembled.usedChars} chars` +
      (assembled.maxChars != null ? ` (cap ${assembled.maxChars})` : ' (uncapped)') +
      (assembled.skipped.length ? `, skipped ${assembled.skipped.length}` : ''),
  );

  const system = [
    'You are a design-system analyst for web UI.',
    'From the provided page HTML and CSS, author a DESIGN.md file compatible with the Design Extractor / Google Stitch DESIGN.md spec.',
    'Reply with ONLY the DESIGN.md file contents — no JSON, no prose before/after.',
    'Required shape:',
    '1) YAML front matter between --- lines with machine-readable tokens: name, contentLanguage, colors, typography, rounded, spacing, components (use {colors.primary}-style refs where useful).',
    'contentLanguage MUST be the primary page content language as ISO 639-1 (optionally with region, e.g. nl, fr, nl-NL, fr-BE). Infer from visible copy and <html lang>; do not invent English when the page is clearly another language.',
    '2) Markdown body with canonical section order when relevant: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do\'s and Don\'ts.',
    'Infer values only from the supplied HTML/CSS; do not invent unrelated brand systems.',
  ].join(' ');

  const user = [
    `Page URL: ${opts.url || 'unknown'}`,
    'Source materials follow.',
    assembled.payload,
  ].join('\n');

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    responseFormat: null,
  });

  if (!result.ok) {
    console.warn(`    … AI design failed: ${result.skipReason}`);
    return { ok: false, skipReason: result.skipReason, model: result.model, usage: result.usage };
  }

  const markdown = extractDesignMarkdown(result.content);
  if (!markdown) {
    const skipReason = 'AI response was not usable DESIGN.md (expected YAML front matter)';
    console.warn(`    … AI design failed: ${skipReason}`);
    return {
      ok: false,
      skipReason,
      model: result.model,
      usage: result.usage,
      costEstimate: result.costEstimate,
    };
  }

  await writeFile(designMdPath, markdown, 'utf8');
  const contentLanguage = extractContentLanguageFromDesignMd(markdown);
  await writeAiUsageMeta(pageDir, {
    purpose: AI_DERIVED_DESIGN_PURPOSE,
    model: result.model,
    ok: true,
    usage: result.usage || null,
    costEstimate: result.costEstimate || null,
    context: {
      sourceHash: assembled.sourceHash,
      ...(contentLanguage ? { contentLanguage } : {}),
    },
  });
  await cleanupLegacy(pageDir);

  const u = result.usage;
  const cost =
    result.costEstimate?.totalUsd != null
      ? `~$${result.costEstimate.totalUsd} (${result.costEstimate.rateNote || 'estimate'})`
      : 'cost estimate unavailable (tokens only)';
  console.log(
    `    … AI design: model=${result.model} in=${u?.promptTokens ?? '?'} out=${u?.completionTokens ?? '?'} total=${u?.totalTokens ?? '?'} ${cost}`,
  );
  console.log(`    … wrote ${AI_DERIVED_DESIGN_MD} + ai-meta.json`);
  if (contentLanguage) {
    console.log(`    … contentLanguage=${contentLanguage}`);
  }

  return {
    ok: true,
    reused: false,
    designMdPath,
    sourceHash: assembled.sourceHash,
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
    contentLanguage,
    input: {
      maxChars: assembled.maxChars,
      usedChars: assembled.usedChars,
      included: assembled.included,
      skippedCount: assembled.skipped.length,
    },
  };
}

/** @deprecated use AI_DERIVED_DESIGN_MD */
export const DESIGN_MD_FILENAME = AI_DERIVED_DESIGN_MD;
