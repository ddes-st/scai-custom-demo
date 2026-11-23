/**
 * M16F — NEKO LITE from full capture page.html with absolute URL rewrite.
 */
import {
  loadNekoLitePrompt,
  callNekoAzure,
  extractTsx,
  extractFenced,
  writeNekoArtifacts,
  nekoSystemExtra,
  preparePageHtmlForNeko,
  pageDesktopCleanPngBuf,
  SITECORE_HOME_URL,
} from '../lib/neko-shared.mjs';
import { readPageHtml } from '../lib/io.mjs';

export async function runM16F() {
  const lite = await loadNekoLitePrompt();
  const system = lite + nekoSystemExtra();

  console.log('  M16F full-page…');
  const rawPage = await readPageHtml();
  const prepared = preparePageHtmlForNeko(rawPage, { baseUrl: SITECORE_HOME_URL });
  const png = await pageDesktopCleanPngBuf();
  const images = png ? [png] : [];

  const userText = `Following CONVERSION_TEMPLATE_LITE.md, convert this FULL homepage HTML to Next.js + Tailwind TSX.

Source: capture html/page.html for ${SITECORE_HOME_URL} (relative URLs rewritten to absolute https)
Target: SitecoreHomeNeko.tsx
HTML was style-stripped/truncated for token limits (chars=${prepared.htmlChars}, original=${prepared.originalChars}, truncated=${prepared.truncated}).

Requirements:
- TypeScript React Server Component (no 'use client' unless interactive)
- Tailwind for ALL styling (zero style= attributes)
- Responsive layout matching the attached desktop-clean screenshot when present
- export default function SitecoreHomeNeko
- Prefer absolute https image URLs from the HTML
- Cover primary homepage bands (nav, hero, content sections, footer) as far as the HTML allows

HTML (prepared):
${prepared.html}
`;

  const r = await callNekoAzure({ system, userText, images });
  if (!r.ok) {
    await writeNekoArtifacts('M16F', 'full-page', {
      tsx: `export default function Skipped(){ return <div>${r.skipReason}</div> }\n`,
      raw: r.skipReason,
      meta: {
        method: 'M16F',
        skipped: true,
        reason: r.skipReason,
        ...preparedMeta(prepared),
      },
      htmlFence: `<p>${r.skipReason}</p>`,
    });
    return;
  }

  const tsx = extractTsx(r.content);
  const htmlFence = extractFenced(r.content, 'html');
  await writeNekoArtifacts('M16F', 'full-page', {
    tsx,
    raw: r.content,
    htmlFence,
    meta: {
      method: 'M16F',
      source: 'capture-page-html-absolute',
      model: r.model,
      cost: r.cost,
      usage: r.usage,
      tool: 'NEKO CONVERSION_TEMPLATE_LITE',
      ...preparedMeta(prepared),
    },
  });
}

function preparedMeta(prepared) {
  return {
    htmlChars: prepared.htmlChars,
    originalChars: prepared.originalChars,
    truncated: prepared.truncated,
    stylesStripped: prepared.stylesStripped,
  };
}
