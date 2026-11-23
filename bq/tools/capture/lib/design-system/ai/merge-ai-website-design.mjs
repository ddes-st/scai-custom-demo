/**
 * Merge page-level ai-derived-design.md files into project ai-website-design.md.
 * Skips Azure when meta sourceHash matches (unless --force design).
 * Single page source: copy + stamp meta (no Azure).
 */
import { createHash } from 'node:crypto';
import { access, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getAiUsageEntry,
  writeAiUsageMeta,
} from '../../../../shared/ai-usage-meta.mjs';
import { azureChatCompletion, resolveAzureChatConfig } from './azure-chat.mjs';
import { AI_DERIVED_DESIGN_MD } from './generate-ai-design-guide.mjs';
import { shouldForce } from '../../force-kinds.mjs';

export const AI_WEBSITE_DESIGN_MD = 'ai-website-design.md';
/** @deprecated Skip/usage live in projectRoot/ai-meta.json (purpose ai-website-design). */
export const AI_WEBSITE_DESIGN_META = 'ai-website-design.meta.json';
export const AI_WEBSITE_DESIGN_PURPOSE = 'ai-website-design';

function sha256Hex(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

function extractDesignMarkdown(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();
  const fenced = s.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();
  const fm = s.indexOf('---');
  if (fm >= 0) s = s.slice(fm).trim();
  if (!s.includes('---')) return null;
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

async function removeLegacyWebsiteMeta(projectRoot) {
  try {
    await unlink(path.join(projectRoot, AI_WEBSITE_DESIGN_META));
  } catch {
    /* none */
  }
}

/**
 * @param {string} projectRoot
 * @returns {Promise<Array<{ pageSlug: string, path: string, markdown: string }>>}
 */
export async function collectPageAiDesigns(projectRoot) {
  const entries = await readdir(projectRoot, { withFileTypes: true });
  /** @type {Array<{ pageSlug: string, path: string, markdown: string }>} */
  const pages = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'sections') continue;
    const pageDir = path.join(projectRoot, entry.name);
    const designPath = path.join(pageDir, AI_DERIVED_DESIGN_MD);
    try {
      await access(designPath);
      const markdown = await readFile(designPath, 'utf8');
      if (!markdown.trim()) continue;
      pages.push({
        pageSlug: entry.name,
        path: designPath,
        markdown,
      });
    } catch {
      /* missing */
    }
  }
  pages.sort((a, b) => a.pageSlug.localeCompare(b.pageSlug));
  return pages;
}

/** Stable hash over concatenated page designs (slug order). */
export function sourceHashForPageDesigns(pageDesigns) {
  const parts = pageDesigns.map((p) => `===== ${p.pageSlug} =====\n${p.markdown}`);
  return sha256Hex(parts.join('\n\n'));
}

/**
 * @param {string} projectRoot
 * @param {{ force?: Set<string>, url?: string }} [opts]
 */
export async function mergeAiWebsiteDesign(projectRoot, opts = {}) {
  const forceDesign = shouldForce(opts.force, 'design');
  const pageDesigns = await collectPageAiDesigns(projectRoot);

  if (!pageDesigns.length) {
    console.log(`  … site AI design skipped: no page ${AI_DERIVED_DESIGN_MD} files`);
    return { ok: false, skipReason: 'no page designs' };
  }

  const sourceHash = sourceHashForPageDesigns(pageDesigns);
  const designMdPath = path.join(projectRoot, AI_WEBSITE_DESIGN_MD);
  const mdExists = await fileNonEmpty(designMdPath);
  const usageEntry = await getAiUsageEntry(projectRoot, AI_WEBSITE_DESIGN_PURPOSE);
  const priorHash = usageEntry?.context?.sourceHash || null;

  if (!forceDesign && mdExists && priorHash && priorHash === sourceHash) {
    console.log(`  ✓ ${AI_WEBSITE_DESIGN_MD} (unchanged sourceHash)`);
    return {
      ok: true,
      reused: true,
      designMdPath,
      sourceHash,
      model: usageEntry?.model || null,
      pageCount: pageDesigns.length,
      skipReason: 'sourceHash match',
    };
  }

  const regenReason = forceDesign
    ? 'forced'
    : !mdExists
      ? 'missing'
      : !priorHash
        ? 'meta missing'
        : 'hash mismatch';

  // One page: copy without Azure
  if (pageDesigns.length === 1) {
    const only = pageDesigns[0];
    let markdown = only.markdown.trim();
    if (!markdown.endsWith('\n')) markdown += '\n';
    await writeFile(designMdPath, markdown, 'utf8');
    await writeAiUsageMeta(projectRoot, {
      purpose: AI_WEBSITE_DESIGN_PURPOSE,
      model: 'copy',
      ok: true,
      usage: null,
      costEstimate: null,
      context: {
        sourceHash,
        pageCount: 1,
        pages: [only.pageSlug],
        mode: 'single-page-copy',
      },
    });
    await removeLegacyWebsiteMeta(projectRoot);
    console.log(`  ✓ ${AI_WEBSITE_DESIGN_MD} (copied from ${only.pageSlug}, ${regenReason})`);
    return {
      ok: true,
      reused: false,
      designMdPath,
      sourceHash,
      model: 'copy',
      pageCount: 1,
      mode: 'single-page-copy',
    };
  }

  console.log(
    `  … site AI design: merging ${pageDesigns.length} page guide(s) (${regenReason})`,
  );

  const config = resolveAzureChatConfig();
  if (!config.ok) {
    console.warn(`  … site AI design skipped: ${config.skipReason}`);
    return { ok: false, skipReason: config.skipReason, pageCount: pageDesigns.length };
  }

  const system = [
    'You are a design-system analyst for a multi-page website.',
    'Merge the provided per-page DESIGN.md guides into one site-wide DESIGN.md compatible with the Design Extractor / Google Stitch DESIGN.md spec.',
    'Reconcile and unify tokens and guidance across pages; prefer shared brand tokens; note page-specific exceptions briefly.',
    'Reply with ONLY the DESIGN.md file contents — no JSON, no prose before/after.',
    'Required shape:',
    '1) YAML front matter between --- lines with machine-readable tokens: name, colors, typography, rounded, spacing, components (use {colors.primary}-style refs where useful).',
    '2) Markdown body with canonical section order when relevant: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do\'s and Don\'ts.',
    'Infer only from the supplied page guides; do not invent unrelated brand systems.',
  ].join(' ');

  const userParts = [
    `Site URL: ${opts.url || 'unknown'}`,
    `Page guides to merge (${pageDesigns.length}):`,
  ];
  for (const page of pageDesigns) {
    userParts.push(`\n\n===== PAGE: ${page.pageSlug} =====\n${page.markdown}`);
  }

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userParts.join('\n') },
    ],
    responseFormat: null,
  });

  if (!result.ok) {
    console.warn(`  … site AI design failed: ${result.skipReason}`);
    return {
      ok: false,
      skipReason: result.skipReason,
      model: result.model,
      usage: result.usage,
      pageCount: pageDesigns.length,
    };
  }

  const markdown = extractDesignMarkdown(result.content);
  if (!markdown) {
    const skipReason = 'AI response was not usable DESIGN.md (expected YAML front matter)';
    console.warn(`  … site AI design failed: ${skipReason}`);
    return {
      ok: false,
      skipReason,
      model: result.model,
      usage: result.usage,
      costEstimate: result.costEstimate,
      pageCount: pageDesigns.length,
    };
  }

  await writeFile(designMdPath, markdown, 'utf8');
  await writeAiUsageMeta(projectRoot, {
    purpose: AI_WEBSITE_DESIGN_PURPOSE,
    model: result.model,
    ok: true,
    usage: result.usage || null,
    costEstimate: result.costEstimate || null,
    context: {
      sourceHash,
      pageCount: pageDesigns.length,
      pages: pageDesigns.map((p) => p.pageSlug),
      mode: 'azure-merge',
    },
  });
  await removeLegacyWebsiteMeta(projectRoot);

  const u = result.usage;
  const cost =
    result.costEstimate?.totalUsd != null
      ? `~$${result.costEstimate.totalUsd} (${result.costEstimate.rateNote || 'estimate'})`
      : 'cost estimate unavailable (tokens only)';
  console.log(
    `  … site AI design: model=${result.model} in=${u?.promptTokens ?? '?'} out=${u?.completionTokens ?? '?'} total=${u?.totalTokens ?? '?'} ${cost}`,
  );
  console.log(`  ✓ wrote ${AI_WEBSITE_DESIGN_MD} + ai-meta.json`);

  return {
    ok: true,
    reused: false,
    designMdPath,
    sourceHash,
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
    pageCount: pageDesigns.length,
    mode: 'azure-merge',
  };
}
