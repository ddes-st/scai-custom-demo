/**
 * M16S — NEKO LITE from section.html + desktop/tablet/mobile screenshots.
 */
import {
  loadNekoLitePrompt,
  callNekoAzure,
  extractTsx,
  extractFenced,
  writeNekoArtifacts,
  nekoSystemExtra,
  sectionScreenshotBuffers,
  componentNameFor,
} from '../lib/neko-shared.mjs';
import { readSectionHtml, readSectionInfo } from '../lib/io.mjs';

export async function runM16S(sections = ['section-03']) {
  const lite = await loadNekoLitePrompt();
  const system = lite + nekoSystemExtra();

  for (const section of sections) {
    console.log(`  M16S ${section}…`);
    const html = (await readSectionHtml(section)).slice(0, 12000);
    const info = await readSectionInfo(section);
    const name = componentNameFor(section);
    const shots = await sectionScreenshotBuffers(section);
    const images = shots.map((s) => s.buf);
    const vpLabel = shots.map((s) => s.vp).join(', ') || 'none';

    const userText = `Following CONVERSION_TEMPLATE_LITE.md, convert this homepage section to Next.js + Tailwind TSX.

Source: capture section.html for ${section} (cmsName=${info.cmsName || 'unknown'})
Target: ${name}.tsx
Heading: ${info.heading || ''}

Attached images (in order): ${vpLabel}
Match ALL three viewports with responsive Tailwind breakpoints (md:/lg:). Screenshots win on layout; HTML provides real text/structure.

Requirements:
- TypeScript React Server Component (no 'use client' unless interactive)
- Tailwind for ALL styling (zero style= attributes)
- 90%+ visual resemblance across desktop/tablet/mobile when screenshots are present
- export default function ${name}

HTML (truncated):
${html}
`;

    const r = await callNekoAzure({ system, userText, images });
    if (!r.ok) {
      await writeNekoArtifacts('M16S', section, {
        tsx: `export default function Skipped(){ return <div>${r.skipReason}</div> }\n`,
        raw: r.skipReason,
        meta: { method: 'M16S', skipped: true, reason: r.skipReason, viewports: vpLabel },
        htmlFence: `<p>${r.skipReason}</p>`,
      });
      continue;
    }

    const tsx = extractTsx(r.content);
    const htmlFence = extractFenced(r.content, 'html');
    await writeNekoArtifacts('M16S', section, {
      tsx,
      raw: r.content,
      htmlFence,
      meta: {
        method: 'M16S',
        source: 'capture-section-html-3vp',
        model: r.model,
        cost: r.cost,
        usage: r.usage,
        tool: 'NEKO CONVERSION_TEMPLATE_LITE',
        viewports: vpLabel,
        imageCount: images.length,
      },
    });
  }
}
