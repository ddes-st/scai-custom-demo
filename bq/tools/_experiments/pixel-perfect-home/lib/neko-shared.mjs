/**
 * Shared helpers for NEKO-style Tailwind TSX conversion + CDN preview scoring.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  azureChatCompletion,
  imageContentPart,
  resolveAzureChatConfig,
  estimateCostUsd,
} from '../../../capture/lib/design-system/ai/azure-chat.mjs';
import { loadLocalEnvFiles } from '../../../capture/lib/design-system/load-env.mjs';
import { bqRoot } from '../../../capture/paths.mjs';
import { experimentToolRoot, capturePageDir } from './paths.mjs';
import {
  wrapHtmlDocument,
  writeMethodArtifacts,
  escapeForJsString,
  exists,
  methodTargetDir,
  rewriteHtmlToAbsoluteUrls,
  preparePageHtmlForNeko,
} from './io.mjs';
import { withStabilize } from './preview-tweaks.mjs';

export const NEKO_BAKEOFF = ['section-04', 'section-07', 'section-13'];
export const SITECORE_HOME_URL = 'https://www.sitecore.com/';

export { rewriteHtmlToAbsoluteUrls, preparePageHtmlForNeko };

const TAILWIND_CDN = `<script src="https://cdn.tailwindcss.com"></script>`;

export async function loadNekoLitePrompt() {
  const p = path.join(experimentToolRoot, 'prompts', 'neko-conversion-lite.md');
  return readFile(p, 'utf8');
}

export function cheapModel() {
  loadLocalEnvFiles({ root: bqRoot });
  return (
    process.env.BQ_EXP_CHEAP_VISION_MODEL ||
    process.env.AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL ||
    process.env.AZURE_OPENAI_DEFAULT_MODEL ||
    ''
  ).trim();
}

export async function shrinkPng(filePath, maxW = 900) {
  return sharp(filePath).resize({ width: maxW, withoutEnlargement: true }).png().toBuffer();
}

export async function callNekoAzure({ system, userText, images = [] }) {
  const cfg = resolveAzureChatConfig();
  if (!cfg.ok) return { ok: false, skipReason: cfg.skipReason };
  const parts = [{ type: 'text', text: userText }];
  for (const img of images) parts.push(imageContentPart(img));
  const res = await azureChatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: parts },
    ],
    model: cheapModel() || cfg.model,
  });
  if (!res.ok) return { ok: false, skipReason: res.skipReason || 'azure failed', model: res.model };
  return {
    ok: true,
    content: String(res.content || ''),
    usage: res.usage,
    cost: res.costEstimate || estimateCostUsd(res.model, res.rawUsage),
    model: res.model,
  };
}

export function extractFenced(content, lang) {
  const re = new RegExp('```' + lang + '\\s*([\\s\\S]*?)```', 'i');
  const m = String(content || '').match(re);
  return m ? m[1].trim() : null;
}

export function extractTsx(content) {
  return (
    extractFenced(content, 'tsx') ||
    extractFenced(content, 'jsx') ||
    extractFenced(content, 'typescript') ||
    String(content || '').trim()
  );
}

/**
 * Build a scorable HTML preview from TSX or an HTML fence.
 * Prefer ```html fence; else strip TSX return body and convert className→class.
 */
export function buildTailwindPreview(tsxOrRaw, { title = 'neko preview', htmlFence = null } = {}) {
  let body = htmlFence;
  if (!body) {
    const fromTsx = tsxOrRaw.match(/return\s*\(\s*([\s\S]*?)\s*\);\s*\}/);
    if (fromTsx) {
      body = fromTsx[1]
        .trim()
        .replace(/^<>\s*/, '')
        .replace(/\s*<\/>$/, '')
        .replace(/className=/g, 'class=')
        .replace(/htmlFor=/g, 'for=')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\{`([^`]*)`\}/g, '$1')
        .replace(/\{'([^']*)'\}/g, '$1')
        .replace(/\{"([^"]*)"\}/g, '$1');
      // Drop remaining JS expressions
      body = body.replace(/\{[^}]+\}/g, '');
    }
  }
  if (!body || !/<[a-zA-Z]/.test(body)) {
    body = `<pre class="p-4 text-xs whitespace-pre-wrap">${String(tsxOrRaw)
      .slice(0, 3000)
      .replace(/</g, '&lt;')}</pre>`;
  }
  return wrapHtmlDocument(body, {
    title,
    extraHead: `${TAILWIND_CDN}\n${withStabilize()}`,
  });
}

export function nekoSystemExtra() {
  return `

## EXPERIMENT SCORING EXTRA (required)

After the TSX, also emit a second fence \`\`\`html containing a static HTML preview of the same UI:
- Use the same Tailwind class names
- Valid HTML fragment (no html/body wrappers)
- Real text from the source
- Image src may use absolute https URLs from the source when present

Deliver ONLY the \`\`\`tsx and \`\`\`html fences. No setup chatter.
`;
}

export async function writeNekoArtifacts(methodId, section, { tsx, raw, meta, htmlFence }) {
  const previewHtml = buildTailwindPreview(tsx, {
    title: `${methodId} ${section}`,
    htmlFence,
  });
  const dir = await writeMethodArtifacts(methodId, section, {
    tsx,
    previewHtml,
    meta,
  });
  if (raw) await writeFile(path.join(dir, 'raw-model.txt'), raw, 'utf8');
  return dir;
}

export async function desktopPngBuf(section) {
  const p = path.join(capturePageDir, 'sections', section, `${section}-desktop.png`);
  if (!(await exists(p))) return null;
  return shrinkPng(p, 900);
}

/** Desktop / tablet / mobile section PNGs (same sizing as M06). */
export async function sectionScreenshotBuffers(section) {
  const folder = path.join(capturePageDir, 'sections', section);
  const out = [];
  for (const vp of ['desktop', 'tablet', 'mobile']) {
    const p = path.join(folder, `${section}-${vp}.png`);
    if (await exists(p)) {
      out.push({ vp, buf: await shrinkPng(p, vp === 'desktop' ? 900 : 640) });
    }
  }
  return out;
}

export async function pageDesktopCleanPngBuf() {
  const p = path.join(capturePageDir, 'screenshots', 'desktop-clean.png');
  if (!(await exists(p))) return null;
  return shrinkPng(p, 900);
}

export function componentNameFor(section) {
  const n = section.replace(/\D/g, '');
  return `Section${n}Neko`;
}
