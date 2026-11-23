/**
 * M16U — NEKO via live URL fetch + NEKO convert
 * M16U-PROMPT — URL string only (section-04 control)
 */
import { chromium } from 'playwright';
import {
  loadNekoLitePrompt,
  callNekoAzure,
  extractTsx,
  extractFenced,
  writeNekoArtifacts,
  nekoSystemExtra,
  componentNameFor,
  NEKO_BAKEOFF,
  SITECORE_HOME_URL,
} from '../lib/neko-shared.mjs';
import { readSectionHtml, readSectionInfo } from '../lib/io.mjs';

/**
 * Fetch live section outerHTML from sitecore.com using capture selector.
 */
async function fetchLiveSectionHtml(section) {
  const info = await readSectionInfo(section);
  const selector = info.selector || null;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    await page.goto(SITECORE_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1500);
    // Dismiss common consent if present (best-effort)
    try {
      await page.locator('button:has-text("Accept")').first().click({ timeout: 2500 });
    } catch {
      /* ignore */
    }
    await page.waitForTimeout(500);

    let html = '';
    let fetchMode = 'selector';
    if (selector) {
      html = await page.evaluate((sel) => {
        try {
          const el = document.querySelector(sel);
          return el ? el.outerHTML : '';
        } catch {
          return '';
        }
      }, selector);
    }
    if (!html) {
      fetchMode = 'capture-fallback';
      html = await readSectionHtml(section);
    }
    await context.close();
    return { html, fetchMode, selector, info };
  } finally {
    await browser.close();
  }
}

export async function runM16U(sections = NEKO_BAKEOFF) {
  const lite = await loadNekoLitePrompt();
  const system = lite + nekoSystemExtra();

  for (const section of sections) {
    console.log(`  M16U ${section} (live URL fetch)…`);
    const { html, fetchMode, selector, info } = await fetchLiveSectionHtml(section);
    const name = componentNameFor(section);
    const truncated = html.slice(0, 12000);

    const userText = `Following CONVERSION_TEMPLATE_LITE.md, convert this page band to Next.js + Tailwind TSX.

Source: ${SITECORE_HOME_URL}
Target: ${name}.tsx
Homepage band: ${info.cmsName || section}
Heading: ${info.heading || ''}
Selector used to extract band: ${selector || '(none)'}
Fetch mode: ${fetchMode}

Requirements:
- TypeScript React Server Component
- Tailwind for ALL styling (zero style=)
- 90%+ visual resemblance
- export default function ${name}

HTML fetched from the Source URL for this band (truncated):
${truncated}
`;

    const r = await callNekoAzure({ system, userText, images: [] });
    if (!r.ok) {
      await writeNekoArtifacts('M16U', section, {
        tsx: `export default function Skipped(){ return <div>${r.skipReason}</div> }\n`,
        raw: r.skipReason,
        meta: { method: 'M16U', skipped: true, reason: r.skipReason, fetchMode },
        htmlFence: `<p>${r.skipReason}</p>`,
      });
      continue;
    }

    await writeNekoArtifacts('M16U', section, {
      tsx: extractTsx(r.content),
      raw: r.content,
      htmlFence: extractFenced(r.content, 'html'),
      meta: {
        method: 'M16U',
        sourceUrl: SITECORE_HOME_URL,
        fetchMode,
        selector,
        model: r.model,
        cost: r.cost,
        usage: r.usage,
        tool: 'NEKO CONVERSION_TEMPLATE_LITE + live URL fetch',
      },
    });
  }
}

/** URL string only — no HTML, no screenshot */
export async function runM16UPromptOnly(section = 'section-04') {
  console.log(`  M16U-PROMPT ${section} (URL only)…`);
  const lite = await loadNekoLitePrompt();
  const system = lite + nekoSystemExtra();
  const info = await readSectionInfo(section);
  const name = componentNameFor(section);

  const userText = `Following CONVERSION_TEMPLATE_LITE.md, convert this page to Next.js + Tailwind TSX.

Source: ${SITECORE_HOME_URL}
Target: ${name}.tsx

Focus on the homepage hero / technology hero band (cmsName hint: ${info.cmsName || 'AIAssistedHeroBanner'}).
Heading hint: ${info.heading || 'AI is deciding who gets discovered...'}

You are given ONLY the URL and this description — do not assume you have HTML attached.
Recreate the visual appearance as faithfully as you can from knowledge of that public page.

Requirements:
- TypeScript React Server Component
- Tailwind for ALL styling
- export default function ${name}
`;

  const r = await callNekoAzure({ system, userText, images: [] });
  if (!r.ok) {
    await writeNekoArtifacts('M16U-PROMPT', section, {
      tsx: `export default function Skipped(){ return <div>${r.skipReason}</div> }\n`,
      raw: r.skipReason,
      meta: { method: 'M16U-PROMPT', skipped: true, reason: r.skipReason },
      htmlFence: `<p>${r.skipReason}</p>`,
    });
    return;
  }

  await writeNekoArtifacts('M16U-PROMPT', section, {
    tsx: extractTsx(r.content),
    raw: r.content,
    htmlFence: extractFenced(r.content, 'html'),
    meta: {
      method: 'M16U-PROMPT',
      sourceUrl: SITECORE_HOME_URL,
      input: 'url-string-only',
      model: r.model,
      cost: r.cost,
      usage: r.usage,
      tool: 'NEKO LITE URL-only control',
    },
  });
}

export async function runNekoUrlAll() {
  await runM16U(NEKO_BAKEOFF);
  await runM16UPromptOnly('section-04');
}
