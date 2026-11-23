/**
 * AI / hybrid methods M6–M10 (cheap model preferred; uses BQ Azure chat helper).
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
import {
  readSectionHtml,
  readSectionInfo,
  rewriteCaptureAssetUrls,
  wrapHtmlDocument,
  writeMethodArtifacts,
  escapeForJsString,
  exists,
  methodTargetDir,
} from '../lib/io.mjs';
import { withStabilize } from '../lib/preview-tweaks.mjs';
import { capturePageDir, SAMPLE_SECTIONS } from '../lib/paths.mjs';
import { scoreMethodTarget } from '../harness/score.mjs';

function cheapModel() {
  loadLocalEnvFiles({ root: bqRoot });
  return (
    process.env.BQ_EXP_CHEAP_VISION_MODEL ||
    process.env.AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL ||
    process.env.AZURE_OPENAI_DEFAULT_MODEL ||
    ''
  ).trim();
}

async function shrinkPng(filePath, maxW = 768) {
  const buf = await sharp(filePath).resize({ width: maxW, withoutEnlargement: true }).png().toBuffer();
  return buf;
}

function extractTsxOrHtml(content) {
  const text = String(content || '').trim();
  const fence = text.match(/```(?:tsx|jsx|html)?\s*([\s\S]*?)```/);
  return (fence ? fence[1] : text).trim();
}

function htmlFromModelOutput(out) {
  // If model returned TSX, strip to a rough preview by extracting return (...) html-ish — fallback wrap as pre
  if (out.includes('dangerouslySetInnerHTML') || out.includes('export default') || out.includes('function ')) {
    // Prefer fenced HTML if any; else create a note preview
    const htmlFence = String(out).match(/```html\s*([\s\S]*?)```/);
    if (htmlFence) return htmlFence[1];
    return null;
  }
  return out;
}

async function callVision({ system, userText, images, model }) {
  const cfg = resolveAzureChatConfig();
  if (!cfg.ok) return { ok: false, skipReason: cfg.skipReason };
  const parts = [{ type: 'text', text: userText }];
  for (const img of images) {
    parts.push(imageContentPart(img));
  }
  const res = await azureChatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: parts },
    ],
    model: model || cheapModel() || cfg.model,
    // omit temperature — many Foundry models reject non-default
  });
  if (!res.ok) {
    return { ok: false, skipReason: res.skipReason || 'azure chat failed', model: res.model };
  }
  const content = res.content || '';
  const usage = res.usage;
  const cost = res.costEstimate || estimateCostUsd(res.model, res.rawUsage);
  return { ok: true, content: String(content), usage, cost, model: res.model };
}

async function sectionScreenshotBuffers(section) {
  const folder = path.join(capturePageDir, 'sections', section);
  const out = [];
  for (const vp of ['desktop', 'tablet', 'mobile']) {
    const p = path.join(folder, `${section}-${vp}.png`);
    if (await exists(p)) out.push({ vp, buf: await shrinkPng(p, vp === 'desktop' ? 900 : 640) });
  }
  return out;
}

function fallbackPreviewFromTsx(tsx, section) {
  // Last-resort: show TSX source so score still runs (will mismatch heavily)
  return wrapHtmlDocument(
    `<pre style="white-space:pre-wrap;font:12px monospace;padding:1rem;">TSX generated for ${section} — preview HTML extraction failed.\n\n${tsx.slice(0, 2000).replace(/</g, '&lt;')}</pre>`,
    { title: `AI ${section}`, extraHead: withStabilize() }
  );
}

function tsxToPreviewHtml(tsx, section) {
  // Try to pull a return ( <>...</> ) block's JSX and naively convert a subset to HTML
  const m = tsx.match(/return\s*\(\s*([\s\S]*?)\s*\);\s*\}/);
  if (!m) return null;
  let jsx = m[1].trim();
  // className -> class, remove React-only
  jsx = jsx
    .replace(/className=/g, 'class=')
    .replace(/htmlFor=/g, 'for=')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\{`([^`]*)`\}/g, '$1')
    .replace(/\{'([^']*)'\}/g, '$1')
    .replace(/\{"([^"]*)"\}/g, '$1');
  // Drop JS expressions that remain
  if (/\{[^}]+\}/.test(jsx)) {
    jsx = jsx.replace(/\{[^}]+\}/g, '');
  }
  if (!/<[a-zA-Z]/.test(jsx)) return null;
  return wrapHtmlDocument(jsx, { title: `AI ${section}`, extraHead: withStabilize() });
}

/** M6 — cheap VLM one-shot from screenshots only */
export async function runM6(sections = SAMPLE_SECTIONS.slice(0, 1)) {
  const costs = [];
  for (const section of sections) {
    const shots = await sectionScreenshotBuffers(section);
    if (!shots.length) {
      await writeMethodArtifacts('M06', section, {
        tsx: `export default function Missing(){return null}`,
        previewHtml: wrapHtmlDocument('<p>missing screenshots</p>'),
        meta: { method: 'M6', skipped: true, reason: 'no screenshots' },
      });
      continue;
    }
    const r = await callVision({
      system:
        'You convert UI screenshots into a single self-contained React TSX component using Tailwind utility classes. Output ONLY TSX in a fenced ```tsx block. Match layout, spacing, colors, typography as closely as possible. Use semantic HTML. No markdown commentary.',
      userText: `Recreate this website section as a React function component named Section${section.replace(/\D/g, '')}OneShot. Images are desktop/tablet/mobile (in that order when present). Prefer desktop layout with responsive Tailwind breakpoints (md:/lg:).`,
      images: shots.map((s) => s.buf),
    });
    if (!r.ok) {
      await writeMethodArtifacts('M06', section, {
        tsx: `export default function Skipped(){return <div>${r.skipReason}</div>}`,
        previewHtml: wrapHtmlDocument(`<p>${r.skipReason}</p>`),
        meta: { method: 'M6', skipped: true, reason: r.skipReason },
      });
      continue;
    }
    costs.push(r.cost);
    const tsx = extractTsxOrHtml(r.content);
    const preview = tsxToPreviewHtml(tsx, section) || fallbackPreviewFromTsx(tsx, section);
    // Also ask for HTML preview twin for scoring if JSX conversion weak — store raw
    await writeMethodArtifacts('M06', section, {
      tsx,
      previewHtml: preview,
      meta: { method: 'M6', model: r.model, cost: r.cost, usage: r.usage },
    });
    await writeFile(path.join(methodTargetDir('M06', section), 'raw-model.txt'), r.content, 'utf8');
  }
  return costs;
}

/** M7 — multimodal: screenshots + truncated section.html + fields */
export async function runM7(sections = SAMPLE_SECTIONS.slice(0, 1)) {
  const costs = [];
  for (const section of sections) {
    const shots = await sectionScreenshotBuffers(section);
    const html = (await readSectionHtml(section)).slice(0, 12000);
    const info = await readSectionInfo(section);
    const r = await callVision({
      system:
        'You convert capture evidence into pixel-faithful React TSX (Tailwind). Screenshots win on layout; HTML provides real text/classes/structure. Output ONLY ```tsx. Also append a second fence ```html with a static HTML preview that uses inline styles or the CSS from the HTML evidence so it can be screenshot-tested without a bundler.',
      userText: `Section ${section}. cmsName=${info.cmsName}. Fields JSON:\n${JSON.stringify(info.suggestedFields || [], null, 2).slice(0, 4000)}\n\nHTML (truncated):\n${html}`,
      images: shots.map((s) => s.buf),
    });
    if (!r.ok) {
      await writeMethodArtifacts('M07', section, {
        tsx: `export default function Skipped(){return null}`,
        previewHtml: wrapHtmlDocument(`<p>${r.skipReason}</p>`),
        meta: { method: 'M7', skipped: true, reason: r.skipReason },
      });
      continue;
    }
    costs.push(r.cost);
    const tsxFence = r.content.match(/```tsx\s*([\s\S]*?)```/i);
    const htmlFence = r.content.match(/```html\s*([\s\S]*?)```/i);
    const tsx = (tsxFence ? tsxFence[1] : extractTsxOrHtml(r.content)).trim();
    let previewHtml;
    if (htmlFence) {
      previewHtml = wrapHtmlDocument(htmlFence[1], { title: `M7 ${section}`, extraHead: withStabilize() });
    } else {
      // Fall back to capture HTML (multimodal should still produce TSX)
      const rewritten = rewriteCaptureAssetUrls(await readSectionHtml(section), {
        fromDir: path.join(capturePageDir, 'sections', section),
      });
      previewHtml =
        tsxToPreviewHtml(tsx, section) ||
        wrapHtmlDocument(rewritten, { title: `M7 ${section}`, extraHead: withStabilize() });
    }
    await writeMethodArtifacts('M07', section, {
      tsx,
      previewHtml,
      meta: { method: 'M7', model: r.model, cost: r.cost, usage: r.usage },
    });
    await writeFile(path.join(methodTargetDir('M07', section), 'raw-model.txt'), r.content, 'utf8');
  }
  return costs;
}

/** M8 — generate (M7-like) then converge with pixel heatmap ≤2 iters */
export async function runM8(sections = SAMPLE_SECTIONS.slice(0, 1)) {
  // Seed from M7 if present else run M7
  await runM7(sections);
  const costs = [];
  for (const section of sections) {
    const dir = methodTargetDir('M08', section);
    // Copy seed
    const seedDir = methodTargetDir('M07', section);
    const tsx = await readFile(path.join(seedDir, 'Component.tsx'), 'utf8').catch(() => null);
    const preview = await readFile(path.join(seedDir, 'preview.html'), 'utf8').catch(() => null);
    if (!tsx || !preview) continue;
    await writeMethodArtifacts('M08', section, {
      tsx,
      previewHtml: preview,
      meta: { method: 'M8', stage: 'seed-from-M07' },
    });

    for (let iter = 1; iter <= 2; iter++) {
      await scoreMethodTarget(dir);
      const desktopScorePath = path.join(dir, 'scores', 'desktop', 'score-desktop.json');
      if (!(await exists(desktopScorePath))) break;
      const score = JSON.parse(await readFile(desktopScorePath, 'utf8'));
      if (score.mismatchPercent != null && score.mismatchPercent <= 3) break;

      const heat = await readFile(score.diffPngPath);
      const refShot = await shrinkPng(
        path.join(capturePageDir, 'sections', section, `${section}-desktop.png`),
        900
      );
      const cand = await shrinkPng(score.candidatePngPath, 900);
      const heatSmall = await sharp(heat).resize({ width: 900, withoutEnlargement: true }).png().toBuffer();

      const r = await callVision({
        system:
          'You patch a static HTML preview toward pixel-perfect match. You receive reference screenshot, candidate screenshot, and a mismatch heatmap (magenta = error). Return ONLY ```html with a full body fragment (no html/body wrappers) that fixes the largest visual errors. Keep real text.',
        userText: `Iteration ${iter}. Current mismatchPercent=${score.mismatchPercent}. Current HTML:\n${(await readFile(path.join(dir, 'preview.html'), 'utf8')).slice(0, 14000)}`,
        images: [refShot, cand, heatSmall],
      });
      if (!r.ok) break;
      costs.push(r.cost);
      const html = extractTsxOrHtml(r.content);
      const body = html.replace(/^```html|```$/g, '').trim();
      const previewHtml = wrapHtmlDocument(body.includes('<') ? body : html, {
        title: `M8 ${section} iter${iter}`,
        extraHead: withStabilize(),
      });
      await writeFile(path.join(dir, 'preview.html'), previewHtml, 'utf8');
      await writeFile(path.join(dir, `patch-iter-${iter}.txt`), r.content, 'utf8');
      // Keep TSX note
      const patchedTsx = `import React from 'react';\n/** M8 converged preview — see preview.html */\nexport default function SectionConverged(){\n  return <div dangerouslySetInnerHTML={{ __html: \`${escapeForJsString(body.slice(0, 50000))}\` }} />;\n}\n`;
      await writeFile(path.join(dir, 'Component.tsx'), patchedTsx, 'utf8');
    }
  }
  return costs;
}

/** M9 — sandbox use of BQ codegen prompt style (read-only prompts) */
export async function runM9(sections = SAMPLE_SECTIONS.slice(0, 1)) {
  let systemPrompt = 'You are a Sitecore XM Cloud UI codegen assistant. Emit React TSX + companion HTML preview.';
  try {
    const p = path.join(bqRoot, 'tools/create-section-components/prompts/system-codegen.md');
    if (await exists(p)) {
      systemPrompt = (await readFile(p, 'utf8')).slice(0, 12000);
    }
  } catch {
    /* use default */
  }
  const costs = [];
  for (const section of sections) {
    const shots = await sectionScreenshotBuffers(section);
    const html = (await readSectionHtml(section)).slice(0, 10000);
    const info = await readSectionInfo(section);
    const r = await callVision({
      system: systemPrompt + '\n\nEXTRA: Also output ```html preview sibling for static scoring.',
      userText: `Generate component for ${info.cmsName || section}. suggestedFields=${JSON.stringify(info.suggestedFields || []).slice(0, 3000)}\nHTML:\n${html}`,
      images: shots.map((s) => s.buf),
    });
    if (!r.ok) {
      await writeMethodArtifacts('M09', section, {
        tsx: 'export default function Skipped(){return null}',
        previewHtml: wrapHtmlDocument(`<p>${r.skipReason}</p>`),
        meta: { method: 'M9', skipped: true, reason: r.skipReason },
      });
      continue;
    }
    costs.push(r.cost);
    const tsxFence = r.content.match(/```tsx\s*([\s\S]*?)```/i);
    const htmlFence = r.content.match(/```html\s*([\s\S]*?)```/i);
    const tsx = (tsxFence ? tsxFence[1] : extractTsxOrHtml(r.content)).trim();
    const rewritten = rewriteCaptureAssetUrls(await readSectionHtml(section), {
      fromDir: path.join(capturePageDir, 'sections', section),
    });
    const previewHtml = htmlFence
      ? wrapHtmlDocument(htmlFence[1], { title: `M9 ${section}`, extraHead: withStabilize() })
      : wrapHtmlDocument(rewritten, { title: `M9 ${section} fallback-html`, extraHead: withStabilize() });
    await writeMethodArtifacts('M09', section, {
      tsx,
      previewHtml,
      meta: { method: 'M9', model: r.model, cost: r.cost, note: 'BQ system-codegen.md prompt (sandbox)' },
    });
  }
  return costs;
}

/** M10 — hybrid: freeze M4 HTML structure, AI only patches CSS from heatmap */
export async function runM10(sections = SAMPLE_SECTIONS.slice(0, 1)) {
  const costs = [];
  for (const section of sections) {
    const m4preview = path.join(methodTargetDir('M04', section), 'preview.html');
    if (!(await exists(m4preview))) {
      const { runM4 } = await import('./m1-m5.mjs');
      await runM4([section]);
    }
    let html = await readFile(path.join(methodTargetDir('M04', section), 'preview.html'), 'utf8');
    await writeMethodArtifacts('M10', section, {
      tsx: await readFile(path.join(methodTargetDir('M04', section), 'Component.tsx'), 'utf8'),
      previewHtml: html,
      meta: { method: 'M10', stage: 'seed-M4' },
    });
    const dir = methodTargetDir('M10', section);
    await scoreMethodTarget(dir);
    const desktopScorePath = path.join(dir, 'scores', 'desktop', 'score-desktop.json');
    if (await exists(desktopScorePath)) {
      const score = JSON.parse(await readFile(desktopScorePath, 'utf8'));
      if (score.mismatchPercent != null && score.mismatchPercent > 3) {
        const heat = await sharp(await readFile(score.diffPngPath))
          .resize({ width: 900, withoutEnlargement: true })
          .png()
          .toBuffer();
        const refShot = await shrinkPng(
          path.join(capturePageDir, 'sections', section, `${section}-desktop.png`),
          900
        );
        const r = await callVision({
          system:
            'You may ONLY adjust CSS (style tags / inline styles). Do not change text content or DOM structure except wrapping. Return full HTML document or body. Goal: reduce magenta heatmap mismatches.',
          userText: `mismatchPercent=${score.mismatchPercent}. HTML:\n${html.slice(0, 16000)}`,
          images: [refShot, heat],
        });
        if (r.ok) {
          costs.push(r.cost);
          const body = extractTsxOrHtml(r.content);
          html = body.includes('<html') ? body : wrapHtmlDocument(body, { extraHead: withStabilize() });
          await writeFile(path.join(dir, 'preview.html'), html, 'utf8');
          await writeFile(
            path.join(dir, 'Component.tsx'),
            `import React from 'react';\nexport default function Hybrid(){return <div dangerouslySetInnerHTML={{__html:\`${escapeForJsString(html).slice(0, 80000)}\`}}/>}\n`,
            'utf8'
          );
          await writeFile(path.join(dir, 'meta.json'), JSON.stringify({ method: 'M10', cost: r.cost, model: r.model }, null, 2));
        }
      }
    }
  }
  return costs;
}

export async function runAiAll(sections = SAMPLE_SECTIONS.slice(0, 1)) {
  console.log('M6…');
  await runM6(sections);
  console.log('M7…');
  await runM7(sections);
  console.log('M8…');
  await runM8(sections);
  console.log('M9…');
  await runM9(sections);
  console.log('M10…');
  await runM10(sections);
}
