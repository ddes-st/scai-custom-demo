/**
 * M16 — NEKO-Template LITE conversion from capture section.html.
 */
import {
  loadNekoLitePrompt,
  callNekoAzure,
  extractTsx,
  extractFenced,
  writeNekoArtifacts,
  nekoSystemExtra,
  desktopPngBuf,
  componentNameFor,
  NEKO_BAKEOFF,
} from '../lib/neko-shared.mjs';
import { readSectionHtml, readSectionInfo } from '../lib/io.mjs';

export async function runM16(sections = NEKO_BAKEOFF) {
  const lite = await loadNekoLitePrompt();
  const system = lite + nekoSystemExtra();

  for (const section of sections) {
    console.log(`  M16 ${section}…`);
    const html = (await readSectionHtml(section)).slice(0, 12000);
    const info = await readSectionInfo(section);
    const name = componentNameFor(section);
    const png = await desktopPngBuf(section);
    const images = png ? [png] : [];

    const userText = `Following CONVERSION_TEMPLATE_LITE.md, convert this homepage section to Next.js + Tailwind TSX.

Source: capture section.html for ${section} (cmsName=${info.cmsName || 'unknown'})
Target: ${name}.tsx
Heading: ${info.heading || ''}

Requirements:
- TypeScript React Server Component (no 'use client' unless interactive)
- Tailwind for ALL styling (zero style= attributes)
- 90%+ visual resemblance to the attached desktop screenshot when present
- export default function ${name}

HTML (truncated):
${html}
`;

    const r = await callNekoAzure({ system, userText, images });
    if (!r.ok) {
      await writeNekoArtifacts('M16', section, {
        tsx: `export default function Skipped(){ return <div>${r.skipReason}</div> }\n`,
        raw: r.skipReason,
        meta: { method: 'M16', skipped: true, reason: r.skipReason },
        htmlFence: `<p>${r.skipReason}</p>`,
      });
      continue;
    }

    const tsx = extractTsx(r.content);
    const htmlFence = extractFenced(r.content, 'html');
    await writeNekoArtifacts('M16', section, {
      tsx,
      raw: r.content,
      htmlFence,
      meta: {
        method: 'M16',
        source: 'capture-section-html',
        model: r.model,
        cost: r.cost,
        usage: r.usage,
        tool: 'NEKO CONVERSION_TEMPLATE_LITE',
      },
    });
  }
}
