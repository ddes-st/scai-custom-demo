import { mkdir, readFile, writeFile, copyFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { capturePageDir, methodsOutRoot } from './paths.mjs';

export async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(p) {
  await mkdir(p, { recursive: true });
  return p;
}

export function methodTargetDir(methodId, target) {
  return path.join(methodsOutRoot, methodId, target);
}

export async function readSectionHtml(sectionFolder) {
  const p = path.join(capturePageDir, 'sections', sectionFolder, 'section.html');
  return readFile(p, 'utf8');
}

export async function readSectionInfo(sectionFolder) {
  const p = path.join(capturePageDir, 'sections', sectionFolder, 'section-information.json');
  return JSON.parse(await readFile(p, 'utf8'));
}

export async function readPageHtml() {
  return readFile(path.join(capturePageDir, 'html', 'page.html'), 'utf8');
}

export async function readDetectedSections() {
  return JSON.parse(await readFile(path.join(capturePageDir, 'detected-sections.json'), 'utf8'));
}

/**
 * Rewrite relative asset URLs so previews served from the experiment static server
 * (`/capture/...` and `/exp/...`) can load CSS/fonts/images.
 */
export function rewriteCaptureAssetUrls(html, { fromDir } = {}) {
  let out = html;
  // Section HTML typically uses ../../css or ../css relative to sections/section-NN
  out = out.replace(/(url\(['"]?)(\.\.\/)+fonts\//g, '$1/capture/fonts/');
  out = out.replace(/(url\(['"]?)(\.\.\/)+css\//g, '$1/capture/css/');
  out = out.replace(/(href=["'])(\.\.\/)+css\//g, '$1/capture/css/');
  out = out.replace(/(href=["'])(\.\.\/)+fonts\//g, '$1/capture/fonts/');
  out = out.replace(/(src=["'])(\.\.\/)+fonts\//g, '$1/capture/fonts/');
  out = out.replace(/(src=["'])(\.\.\/)+css\//g, '$1/capture/css/');

  // page.html patterns
  out = out.replace(/(href=["'])\.\/css\//g, '$1/capture/css/');
  out = out.replace(/(href=["'])css\//g, '$1/capture/css/');
  out = out.replace(/(href=["'])\.\/fonts\//g, '$1/capture/fonts/');
  out = out.replace(/(href=["'])fonts\//g, '$1/capture/fonts/');
  out = out.replace(/(url\(['"]?)\.\/fonts\//g, '$1/capture/fonts/');
  out = out.replace(/(url\(['"]?)fonts\//g, '$1/capture/fonts/');
  out = out.replace(/(url\(['"]?)\.\/css\//g, '$1/capture/css/');
  out = out.replace(/(src=["'])\.\/fonts\//g, '$1/capture/fonts/');

  // Absolute site media that may still be live
  void fromDir;
  return out;
}

/**
 * Rewrite relative / protocol-relative URLs to absolute https URLs for model prompts.
 * Leaves existing https:// URLs alone.
 */
export function rewriteHtmlToAbsoluteUrls(html, baseUrl = 'https://www.sitecore.com/') {
  const base = String(baseUrl || 'https://www.sitecore.com/').replace(/\/?$/, '/');
  const origin = base.replace(/\/$/, '');
  let out = String(html || '');

  // Protocol-relative → https
  out = out.replace(/(href|src|action)=(["'])\/\//gi, '$1=$2https://');
  out = out.replace(/(url\(['"]?)\/\//gi, '$1https://');

  // Capture-relative css/fonts (including ../ chains and ./)
  out = out.replace(/(href=["'])(\.\.\/)+css\//gi, `$1${base}css/`);
  out = out.replace(/(href=["'])(\.\.\/)+fonts\//gi, `$1${base}fonts/`);
  out = out.replace(/(src=["'])(\.\.\/)+css\//gi, `$1${base}css/`);
  out = out.replace(/(src=["'])(\.\.\/)+fonts\//gi, `$1${base}fonts/`);
  out = out.replace(/(url\(['"]?)(\.\.\/)+css\//gi, `$1${base}css/`);
  out = out.replace(/(url\(['"]?)(\.\.\/)+fonts\//gi, `$1${base}fonts/`);
  out = out.replace(/(href=["'])\.\/css\//gi, `$1${base}css/`);
  out = out.replace(/(href=["'])css\//gi, `$1${base}css/`);
  out = out.replace(/(href=["'])\.\/fonts\//gi, `$1${base}fonts/`);
  out = out.replace(/(href=["'])fonts\//gi, `$1${base}fonts/`);
  out = out.replace(/(src=["'])\.\/fonts\//gi, `$1${base}fonts/`);
  out = out.replace(/(src=["'])fonts\//gi, `$1${base}fonts/`);
  out = out.replace(/(url\(['"]?)\.\/fonts\//gi, `$1${base}fonts/`);
  out = out.replace(/(url\(['"]?)fonts\//gi, `$1${base}fonts/`);
  out = out.replace(/(url\(['"]?)\.\/css\//gi, `$1${base}css/`);
  out = out.replace(/(url\(['"]?)css\//gi, `$1${base}css/`);

  // Root-relative paths in href/src/action/url(...) — skip already-absolute schemes
  out = out.replace(/(href|src|action)=(["'])\/(?!\/)/gi, `$1=$2${origin}/`);
  out = out.replace(/(url\(['"]?)\/(?!\/)/gi, `$1${origin}/`);

  // Bare relative ./path (non-css/fonts already handled) for common media attrs
  out = out.replace(/(href|src)=(["'])\.\/(?!https?:)/gi, `$1=$2${base}`);

  return out;
}

const DEFAULT_NEKO_PAGE_MAX_CHARS = 40000;
const MAX_STYLE_BLOCK_CHARS = 800;

/**
 * Absolute-rewrite page.html, shrink huge style blocks, body-priority truncate for NEKO.
 */
export function preparePageHtmlForNeko(html, { maxChars = DEFAULT_NEKO_PAGE_MAX_CHARS, baseUrl } = {}) {
  const originalChars = String(html || '').length;
  let out = rewriteHtmlToAbsoluteUrls(html, baseUrl);

  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (block) => {
    if (block.length <= MAX_STYLE_BLOCK_CHARS) return block;
    return '<!-- style truncated -->';
  });

  const bodyMatch = out.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  let prioritized = bodyMatch ? bodyMatch[1] : out;
  // Prefer body; keep a short head snippet for title/meta if room
  const headMatch = out.match(/<head\b[^>]*>([\s\S]*)<\/head>/i);
  if (headMatch) {
    const headSlim = headMatch[1]
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .slice(0, 2000);
    prioritized = `<!-- head slim -->\n${headSlim}\n<!-- body -->\n${prioritized}`;
  }

  const truncated = prioritized.length > maxChars;
  const htmlOut = truncated ? prioritized.slice(0, maxChars) : prioritized;

  return {
    html: htmlOut,
    originalChars,
    htmlChars: htmlOut.length,
    truncated,
    stylesStripped: originalChars > htmlOut.length,
  };
}

/**
 * Wrap a body fragment into a minimal document for Playwright.
 */
export function wrapHtmlDocument(bodyInner, { title = 'preview', extraHead = '' } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  html,body{margin:0;padding:0;background:#fff;}
</style>
${extraHead}
</head>
<body>
${bodyInner}
</body>
</html>`;
}

/**
 * Write TSX + preview HTML for a method target.
 */
export async function writeMethodArtifacts(methodId, target, {
  tsx,
  previewHtml,
  meta = {},
  clientTsx,
}) {
  const dir = await ensureDir(methodTargetDir(methodId, target));
  if (tsx) await writeFile(path.join(dir, 'Component.tsx'), tsx, 'utf8');
  if (clientTsx) await writeFile(path.join(dir, 'Component.client.tsx'), clientTsx, 'utf8');
  if (previewHtml) await writeFile(path.join(dir, 'preview.html'), previewHtml, 'utf8');
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify({ methodId, target, ...meta }, null, 2));
  return dir;
}

/**
 * Escape for embedding HTML inside a TSX template string / dangerouslySetInnerHTML.
 */
export function escapeForJsString(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

/** Minimal HTML→JSX attribute renames for M11 */
export function htmlToJsxish(html) {
  return html
    .replace(/\sclass=/g, ' className=')
    .replace(/\sfor=/g, ' htmlFor=')
    .replace(/\stabindex=/g, ' tabIndex=')
    .replace(/\sreadonly=/g, ' readOnly=')
    .replace(/\smaxlength=/g, ' maxLength=')
    .replace(/\scellspacing=/g, ' cellSpacing=')
    .replace(/\scellpadding=/g, ' cellPadding=')
    .replace(/\scolspan=/g, ' colSpan=')
    .replace(/\srowspan=/g, ' rowSpan=')
    .replace(/\sstroke-width=/g, ' strokeWidth=')
    .replace(/\sstroke-linecap=/g, ' strokeLinecap=')
    .replace(/\sstroke-linejoin=/g, ' strokeLinejoin=')
    .replace(/\sfill-rule=/g, ' fillRule=')
    .replace(/\sclip-rule=/g, ' clipRule=')
    .replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');
}

export async function listCssFiles() {
  const cssDir = path.join(capturePageDir, 'css');
  const names = await readdir(cssDir);
  return names.filter((n) => n.endsWith('.css')).map((n) => path.join(cssDir, n));
}
