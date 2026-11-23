/**
 * Scope HTML / screenshot evidence for composite child codegen.
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Extract a repeated DOM fragment from section HTML for a child role.
 * Prefer explicit selectors from enrich/plan; else first repeating block heuristic.
 *
 * @param {string} sectionHtml
 * @param {{
 *   selector?: string|null,
 *   repeatName?: string|null,
 *   componentName?: string|null,
 *   index?: number,
 * }} opts
 * @returns {string} scoped HTML (may equal full section if no slice found)
 */
export function sliceChildHtmlFromSection(sectionHtml, opts = {}) {
  const html = String(sectionHtml || '');
  if (!html.trim()) return html;

  const selector = String(opts.selector || '').trim();
  if (selector && !/[<>]/.test(selector)) {
    // Attribute / class / id style selectors — best-effort substring window.
    const attrMatch = selector.match(
      /\[([a-zA-Z0-9_-]+)(?:=['"]?([^'"\]]+)['"]?)?\]/,
    );
    const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);
    const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
    let needle = '';
    if (idMatch) needle = `id="${idMatch[1]}"`;
    else if (classMatch) needle = classMatch[1];
    else if (attrMatch) {
      needle = attrMatch[2]
        ? `${attrMatch[1]}="${attrMatch[2]}"`
        : attrMatch[1];
    }
    if (needle) {
      const idx = html.indexOf(needle);
      if (idx >= 0) {
        const start = html.lastIndexOf('<', idx);
        if (start >= 0) {
          const slice = extractBalancedElement(html, start);
          if (slice && slice.length < html.length * 0.9) return slice;
        }
      }
    }
  }

  // Heuristic: first card / slide / column / list-item like block.
  const patterns = [
    /<(article|li|figure)\b[^>]*>[\s\S]*?<\/\1>/i,
    /<div\b[^>]*(?:card|slide|tile|column|item)[^>]*>[\s\S]*?<\/div>/i,
  ];
  const index = Math.max(0, Number(opts.index) || 0);
  for (const re of patterns) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    const matches = [...html.matchAll(global)];
    if (matches.length > index) {
      const m = matches[index][0];
      if (m && m.length < html.length * 0.9) return m;
    }
  }

  return html;
}

/**
 * @param {string} html
 * @param {number} startIdx — index of '<'
 * @returns {string|null}
 */
function extractBalancedElement(html, startIdx) {
  const open = html.slice(startIdx).match(/^<([a-zA-Z0-9]+)\b[^>]*>/);
  if (!open) return null;
  const tag = open[1];
  const openFull = open[0];
  if (/\/>$/.test(openFull) || /^(img|br|hr|input|meta|link)$/i.test(tag)) {
    return openFull;
  }
  let depth = 0;
  const re = new RegExp(`</?${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = startIdx;
  let m;
  while ((m = re.exec(html))) {
    const isClose = m[0].startsWith('</');
    const selfClose = /\/>$/.test(m[0]);
    if (!isClose && !selfClose) depth += 1;
    else if (isClose) depth -= 1;
    if (depth === 0 && isClose) {
      return html.slice(startIdx, m.index + m[0].length);
    }
    if (depth < 0) break;
  }
  // Fallback window
  return html.slice(startIdx, Math.min(html.length, startIdx + 8000));
}

/**
 * Resolve a crop rectangle (pixels relative to section PNG) for a child band.
 * Prefers child.rect / child.bounds; else equal horizontal or vertical bands by sibling index.
 *
 * @param {{
 *   child?: object,
 *   childIndex?: number,
 *   siblingCount?: number,
 *   imageWidth: number,
 *   imageHeight: number,
 *   axis?: 'y'|'x',
 * }} opts
 * @returns {{ left: number, top: number, width: number, height: number }|null}
 */
export function resolveChildCropRect(opts) {
  const w = Math.max(1, Number(opts.imageWidth) || 0);
  const h = Math.max(1, Number(opts.imageHeight) || 0);
  if (!w || !h) return null;

  const child = opts.child || {};
  const raw =
    child.rect ||
    child.bounds ||
    child.cropRect ||
    child.boundingRect ||
    null;
  if (raw && typeof raw === 'object') {
    const x0 = Number(raw.x0 ?? raw.left ?? raw.x ?? 0);
    const y0 = Number(raw.y0 ?? raw.top ?? raw.y ?? 0);
    const x1 = Number(raw.x1 ?? (raw.left != null ? raw.left + raw.width : NaN));
    const y1 = Number(raw.y1 ?? (raw.top != null ? raw.top + raw.height : NaN));
    if (Number.isFinite(x0) && Number.isFinite(y0) && Number.isFinite(x1) && Number.isFinite(y1)) {
      const left = Math.max(0, Math.min(w - 1, Math.round(x0)));
      const top = Math.max(0, Math.min(h - 1, Math.round(y0)));
      const width = Math.max(1, Math.min(w - left, Math.round(x1 - x0)));
      const height = Math.max(1, Math.min(h - top, Math.round(y1 - y0)));
      if (width < w * 0.95 || height < h * 0.95) {
        return { left, top, width, height };
      }
    }
  }

  const siblingCount = Math.max(1, Number(opts.siblingCount) || 1);
  const index = Math.max(0, Math.min(siblingCount - 1, Number(opts.childIndex) || 0));
  if (siblingCount < 2) return null;

  const axis = opts.axis === 'x' ? 'x' : 'y';
  if (axis === 'x') {
    const band = Math.floor(w / siblingCount);
    const left = index * band;
    const width = index === siblingCount - 1 ? w - left : band;
    return { left, top: 0, width: Math.max(1, width), height: h };
  }
  const band = Math.floor(h / siblingCount);
  const top = index * band;
  const height = index === siblingCount - 1 ? h - top : band;
  if (height < 8) return null;
  return { left: 0, top, width: w, height: Math.max(1, height) };
}

/**
 * Crop a PNG with sharp; returns dest path or null.
 *
 * @param {string} srcAbs
 * @param {string} destAbs
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @returns {Promise<string|null>}
 */
export async function cropPngRegion(srcAbs, destAbs, rect) {
  if (!srcAbs || !destAbs || !rect) return null;
  try {
    const sharp = (await import('sharp')).default;
    await mkdir(path.dirname(destAbs), { recursive: true });
    const meta = await sharp(srcAbs).metadata();
    const iw = meta.width || 0;
    const ih = meta.height || 0;
    if (!iw || !ih) return null;
    const left = Math.max(0, Math.min(iw - 1, Math.round(rect.left)));
    const top = Math.max(0, Math.min(ih - 1, Math.round(rect.top)));
    const width = Math.max(1, Math.min(iw - left, Math.round(rect.width)));
    const height = Math.max(1, Math.min(ih - top, Math.round(rect.height)));
    if (width >= iw * 0.98 && height >= ih * 0.98) return null;
    await sharp(srcAbs)
      .extract({ left, top, width, height })
      .png()
      .toFile(destAbs);
    return destAbs;
  } catch {
    return null;
  }
}

/**
 * Crop viewport PNGs for a child into outDir; returns page-relative paths.
 *
 * @param {{
 *   pageDir: string,
 *   sectionFolder: string,
 *   info?: object,
 *   child?: object,
 *   childIndex?: number,
 *   siblingCount?: number,
 *   outDir: string,
 *   stem?: string,
 * }} opts
 * @returns {Promise<string[]>}
 */
export async function cropChildViewportPngs(opts) {
  const {
    pageDir,
    sectionFolder,
    info,
    child,
    childIndex = 0,
    siblingCount = 1,
    outDir,
    stem = 'child',
  } = opts;
  const outputs = info?.outputs || {};
  /** @type {string[]} */
  const written = [];
  const viewports = ['desktop', 'tablet', 'mobile', 'desktopRegular', 'desktopLarge'];
  for (const vp of viewports) {
    const rel = outputs[vp]?.path;
    if (!rel) continue;
    const srcAbs = path.join(pageDir, rel);
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(srcAbs).metadata();
      const rect = resolveChildCropRect({
        child,
        childIndex,
        siblingCount,
        imageWidth: meta.width || 0,
        imageHeight: meta.height || 0,
      });
      if (!rect) continue;
      const destAbs = path.join(outDir, `${stem}-${vp}.png`);
      const ok = await cropPngRegion(srcAbs, destAbs, rect);
      if (ok) {
        written.push(path.relative(pageDir, destAbs).replace(/\\/g, '/'));
      }
    } catch {
      /* skip viewport */
    }
  }
  void sectionFolder;
  return written;
}

/**
 * Build a child-scoped evidence HTML string + optional crop PNG rels.
 *
 * @param {{
 *   pageDir: string,
 *   sectionFolder: string,
 *   sectionHtml: string,
 *   child: object,
 *   childIndex?: number,
 *   siblingCount?: number,
 *   info?: object,
 *   cropOutDir?: string|null,
 * }} opts
 * @returns {Promise<{ html: string, note: string, cropImageRels: string[] }>}
 */
export async function buildChildScopedEvidence(opts) {
  const {
    pageDir,
    sectionFolder,
    sectionHtml,
    child,
    childIndex = 0,
    siblingCount = 1,
    info = null,
    cropOutDir = null,
  } = opts;
  let html = sectionHtml;
  const sectionDir = path.join(pageDir, 'sections', sectionFolder);
  try {
    const original = await readFile(
      path.join(sectionDir, 'original-section.html'),
      'utf8',
    );
    if (original?.trim()) html = original;
  } catch {
    try {
      const styled = await readFile(path.join(sectionDir, 'section.html'), 'utf8');
      if (styled?.trim()) html = styled;
    } catch {
      /* use sectionHtml */
    }
  }

  const sliced = sliceChildHtmlFromSection(html, {
    selector: child?.selector || child?.rootSelector || null,
    repeatName: child?.repeatName || child?.enrichRole || null,
    componentName: child?.componentName || null,
    index: childIndex,
  });

  const scoped = sliced !== html;

  /** @type {string[]} */
  let cropImageRels = [];
  if (cropOutDir && info?.outputs) {
    const stem = String(child?.componentName || child?.cmsName || `child-${childIndex}`)
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 48) || `child-${childIndex}`;
    cropImageRels = await cropChildViewportPngs({
      pageDir,
      sectionFolder,
      info,
      child,
      childIndex,
      siblingCount,
      outDir: cropOutDir,
      stem,
    });
  }

  const cropNote = cropImageRels.length
    ? ` Attached ${cropImageRels.length} cropped viewport PNG(s) for this child band.`
    : '';

  return {
    html: sliced,
    note: scoped
      ? `CHILD EVIDENCE (hard): HTML below is a scoped fragment for this child unit only — emit only this unit, not parent chrome.${cropNote}`
      : `CHILD EVIDENCE: Could not slice a smaller fragment; emit only your child unit from the full section HTML.${cropNote}`,
    cropImageRels,
  };
}
