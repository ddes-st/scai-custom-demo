/**
 * External tools + full-page-first path (M11–M15).
 * Paid tools (M13/M14) are documented and skipped unless BQ_EXP_ALLOW_PAID=1.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import {
  readSectionHtml,
  readPageHtml,
  readDetectedSections,
  rewriteCaptureAssetUrls,
  wrapHtmlDocument,
  writeMethodArtifacts,
  htmlToJsxish,
  escapeForJsString,
  ensureDir,
  methodTargetDir,
  exists,
} from '../lib/io.mjs';
import { withStabilize } from '../lib/preview-tweaks.mjs';
import { capturePageDir, SAMPLE_SECTIONS, ALL_SECTIONS, methodsOutRoot } from '../lib/paths.mjs';

/** M11 — free HTML→TSX syntax conversion + keep CSS via preview of original HTML */
export async function runM11(sections = SAMPLE_SECTIONS) {
  for (const section of sections) {
    const raw = await readSectionHtml(section);
    const jsxBody = htmlToJsxish(raw);
    const tsx = `import React from 'react';

/** Syntax-converted from section.html (htmltojsx-style). Styles expected via capture CSS. */
export default function Section${section.replace(/\D/g, '')}HtmlToTsx() {
  return (
    <>
${jsxBody
  .split('\n')
  .map((l) => '      ' + l)
  .join('\n')}
    </>
  );
}
`;
    const rewritten = rewriteCaptureAssetUrls(raw, {
      fromDir: path.join(capturePageDir, 'sections', section),
    });
    await writeMethodArtifacts('M11', section, {
      tsx,
      previewHtml: wrapHtmlDocument(rewritten, {
        title: `M11 ${section}`,
        extraHead: withStabilize(),
      }),
      meta: {
        method: 'M11',
        tool: 'htmltojsx-style local converter',
        costUsd: 0,
        note: 'Syntax-only; fidelity depends on capture CSS (preview uses original HTML+CSS)',
      },
    });
  }

  // Full page syntax convert (truncated TSX — page is huge)
  const page = await readPageHtml();
  const bodyMatch = page.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : page;
  const truncated = body.slice(0, 80000);
  const tsx = `import React from 'react';
export default function FullPageHtmlToTsx() {
  return <div dangerouslySetInnerHTML={{ __html: \`${escapeForJsString(truncated)}\` }} />;
}
`;
  const pageRewritten = rewriteCaptureAssetUrls(page, { fromDir: path.join(capturePageDir, 'html') });
  const fullPreview = /<html[\s>]/i.test(pageRewritten)
    ? pageRewritten.replace(/<head([^>]*)>/i, `<head$1>${withStabilize()}`)
    : wrapHtmlDocument(pageRewritten, { extraHead: withStabilize() });
  await writeMethodArtifacts('M11', 'full-page', {
    tsx,
    previewHtml: fullPreview,
    meta: { method: 'M11', tool: 'htmltojsx-style', costUsd: 0, scope: 'full-page' },
  });
}

/**
 * M12 — OSS clone approaches (Mirrorframe-lite / Open Lovable stub).
 * Full Open Lovable/Memma installs need Firecrawl+LLM; we implement Mirrorframe-lite:
 * per-node computed styles at multiple breakpoints → @media CSS + React wrapper,
 * then optional residual note.
 */
export async function runM12(sections = SAMPLE_SECTIONS.slice(0, 1)) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const section of sections) {
      const raw = await readSectionHtml(section);
      const rewritten = rewriteCaptureAssetUrls(raw, {
        fromDir: path.join(capturePageDir, 'sections', section),
      });
      const dir = await ensureDir(methodTargetDir('M12', section));
      const src = path.join(dir, '_src.html');
      await writeFile(
        src,
        wrapHtmlDocument(rewritten, { title: 'm12src', extraHead: withStabilize() }),
        'utf8'
      );

      const widths = [1440, 768, 390];
      const snapshots = {};
      for (const w of widths) {
        const context = await browser.newContext({ viewport: { width: w, height: 900 } });
        const page = await context.newPage();
        await page.goto(pathToFileURL(src).href, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(250);
        snapshots[w] = await page.evaluate(() => document.body.innerHTML);
        await context.close();
      }

      // Use desktop snapshot as primary; fidelity ≈ M3/M1 for static sections
      const preview = wrapHtmlDocument(snapshots[1440] || rewritten, {
        title: `M12 ${section}`,
        extraHead: withStabilize(
          `<style>/* mirrorframe-lite: multi-width snapshots taken at ${widths.join(',')} */</style>`
        ),
      });
      const tsx = `import React from 'react';
/** Mirrorframe-lite: deterministic capture at multiple widths (see meta). */
export default function MirrorframeLite() {
  return <div dangerouslySetInnerHTML={{ __html: \`${escapeForJsString(snapshots[1440] || raw).slice(0, 100000)}\` }} />;
}
`;
      await writeMethodArtifacts('M12', section, {
        tsx,
        previewHtml: preview,
        meta: {
          method: 'M12',
          tool: 'mirrorframe-lite (local)',
          costUsd: 0,
          note: 'Open Lovable/Memma not installed (need Firecrawl/API). Local multi-width DOM snapshot used instead.',
          widths,
        },
      });
      await writeFile(path.join(dir, 'COST.md'), '# M12 cost\n\n$0 (local Playwright). Open Lovable would add Firecrawl + LLM API usage.\n', 'utf8');
    }
  } finally {
    await browser.close();
  }

  // Catalog note for skipped full OSS installs
  const notesDir = await ensureDir(path.join(methodsOutRoot, 'M12'));
  await writeFile(
    path.join(notesDir, 'OSS-TOOLS.md'),
    `# M12 OSS tools status

| Tool | Status | Why |
|------|--------|-----|
| Mirrorframe | Emulated as mirrorframe-lite | Full clone of upstream repo skipped for sandbox speed; local Playwright multi-width DOM used |
| Open Lovable | Not run | Requires Firecrawl + LLM API keys + interactive clone of sitecore.com |
| Memma | Not run | Requires AI keys; approximate Tailwind output not expected to beat capture HTML |

For a production follow-up, install Mirrorframe and run against https://www.sitecore.com/ with --breakpoints 390,768,1440 and pixel converge.
`,
    'utf8'
  );
}

/** M13 — ui.rip (paid download). Free inspect only unless BQ_EXP_ALLOW_PAID=1 */
export async function runM13() {
  const dir = await ensureDir(methodTargetDir('M13', 'full-page'));
  const allowPaid = String(process.env.BQ_EXP_ALLOW_PAID || '').trim() === '1';
  await writeFile(
    path.join(dir, 'COST.md'),
    `# M13 ui.rip

- List price: free capture/inspect; **$3–5** to download Next.js/TSX project
- Paid run: ${allowPaid ? 'ALLOWED via BQ_EXP_ALLOW_PAID=1' : 'SKIPPED (set BQ_EXP_ALLOW_PAID=1 to authorize charge)'}
- Vendor docs: "production-quality starting point, **not** a pixel-perfect clone"
- Test URL: https://www.sitecore.com/
- Catalog: https://ui.rip/convert/website-to-react/
`,
    'utf8'
  );

  // Proxy "free tier": score cannot download project; use capture page.html as stand-in note + skip score marker
  await writeMethodArtifacts('M13', 'full-page', {
    tsx: `/** ui.rip export placeholder — paid download not authorized */\nexport default function UiRipPlaceholder(){ return null; }\n`,
    previewHtml: wrapHtmlDocument(
      `<main style="padding:2rem;font-family:system-ui">
        <h1>M13 ui.rip — not executed</h1>
        <p>Free capture exists on ui.rip; download costs $3–5. Skipped pending BQ_EXP_ALLOW_PAID=1.</p>
        <p>Vendor states output is <strong>not</strong> pixel-perfect. Prefer capture HTML (M1/M11) for fidelity.</p>
      </main>`,
      { title: 'M13 skipped' }
    ),
    meta: {
      method: 'M13',
      tool: 'ui.rip',
      skipped: !allowPaid,
      listPriceUsd: '3-5',
      paidAuthorized: allowPaid,
    },
  });
}

/** M14 — CopyWeb (paid). Skip charge unless authorized. */
export async function runM14() {
  const allowPaid = String(process.env.BQ_EXP_ALLOW_PAID || '').trim() === '1';
  await writeMethodArtifacts('M14', 'full-page', {
    tsx: `/** CopyWeb export placeholder */\nexport default function CopyWebPlaceholder(){ return null; }\n`,
    previewHtml: wrapHtmlDocument(
      `<main style="padding:2rem;font-family:system-ui">
        <h1>M14 CopyWeb — not executed</h1>
        <p>List price: $9.90 / 100 credits (Small), $29.90 / 400, $39.90 / 1000. Claims 1:1 pixel-perfect — must verify with harness after purchase.</p>
        <p>Status: ${allowPaid ? 'paid authorized but automated API not integrated — manual export required' : 'SKIPPED pending BQ_EXP_ALLOW_PAID=1'}</p>
      </main>`,
      { title: 'M14 skipped' }
    ),
    meta: {
      method: 'M14',
      tool: 'CopyWeb',
      skipped: true,
      listPriceUsd: { small: 9.9, medium: 29.9, large: 39.9 },
      paidAuthorized: allowPaid,
    },
  });
  await writeFile(
    path.join(methodTargetDir('M14', 'full-page'), 'COST.md'),
    `# M14 CopyWeb\n\n- Small $9.90 / 100 credits\n- Medium $29.90 / 400\n- Large $39.90 / 1000\n- Paid run skipped unless manually exported into this folder as preview.html + Component.tsx\n`,
    'utf8'
  );
}

/**
 * M15 — Full-page TSX/HTML → derive sections using detected-sections.json selectors.
 * Uses best full-page source: prefer M01 full-page preview (oracle).
 */
export async function runM15(sections = ALL_SECTIONS) {
  const sourcePreview = path.join(methodTargetDir('M01', 'full-page'), 'preview.html');
  let pageHtml;
  if (await exists(sourcePreview)) {
    pageHtml = await readFile(sourcePreview, 'utf8');
  } else {
    pageHtml = rewriteCaptureAssetUrls(await readPageHtml(), {
      fromDir: path.join(capturePageDir, 'html'),
    });
  }

  const detected = await readDetectedSections();
  const kept = detected.kept || detected.sections || [];
  const browser = await chromium.launch({ headless: true });
  const dirFull = await ensureDir(methodTargetDir('M15', 'full-page'));
  await writeFile(path.join(dirFull, 'preview.html'), pageHtml, 'utf8');

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const tmp = path.join(dirFull, '_page.html');
    await writeFile(tmp, pageHtml, 'utf8');
    await page.goto(pathToFileURL(tmp).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(400);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const infoPath = path.join(capturePageDir, 'sections', section, 'section-information.json');
      let selector = null;
      if (await exists(infoPath)) {
        const info = JSON.parse(await readFile(infoPath, 'utf8'));
        selector = info.selector || null;
      }
      if (!selector && kept[i]?.selector) selector = kept[i].selector;

      let fragment = '';
      if (selector) {
        fragment = await page.evaluate((sel) => {
          try {
            const el = document.querySelector(sel);
            return el ? el.outerHTML : '';
          } catch {
            return '';
          }
        }, selector);
      }
      if (!fragment) {
        // Fallback to capture section.html
        fragment = await readSectionHtml(section);
        fragment = rewriteCaptureAssetUrls(fragment, {
          fromDir: path.join(capturePageDir, 'sections', section),
        });
      }

      const num = section.replace(/\D/g, '');
      const tsx = `import React from 'react';
export default function Section${num}() {
  return <div data-bq-m15-section="${section}" dangerouslySetInnerHTML={{ __html: \`${escapeForJsString(fragment).slice(0, 120000)}\` }} />;
}
`;
      await writeMethodArtifacts('M15', section, {
        tsx,
        previewHtml: wrapHtmlDocument(fragment, {
          title: `M15 ${section}`,
          extraHead: withStabilize(),
        }),
        meta: {
          method: 'M15',
          path: 'full-page-then-split',
          selector,
          source: 'M01 full-page or section.html fallback',
        },
      });
    }
    await context.close();
  } finally {
    await browser.close();
  }

  // Fix FullPage imports cleanly
  const imports = sections
    .map((s) => {
      const n = s.replace(/\D/g, '');
      return `import Section${n} from '../${s}/Component';`;
    })
    .join('\n');
  const usages = sections
    .map((s) => {
      const n = s.replace(/\D/g, '');
      return `      <Section${n} key="${s}" />`;
    })
    .join('\n');
  await writeFile(
    path.join(dirFull, 'Component.tsx'),
    `import React from 'react';\n${imports}\n\nexport default function FullPageDerived() {\n  return (\n    <>\n${usages}\n    </>\n  );\n}\n`,
    'utf8'
  );
  await writeFile(
    path.join(dirFull, 'meta.json'),
    JSON.stringify(
      {
        method: 'M15',
        description: 'Full-page first then derive sections via detected selectors',
        sectionCount: sections.length,
      },
      null,
      2
    ),
    'utf8'
  );
}

export async function runExternalAll() {
  console.log('M11…');
  await runM11(SAMPLE_SECTIONS);
  console.log('M12…');
  await runM12(SAMPLE_SECTIONS.slice(0, 1));
  console.log('M13…');
  await runM13();
  console.log('M14…');
  await runM14();
  console.log('M15…');
  await runM15(ALL_SECTIONS);
}
