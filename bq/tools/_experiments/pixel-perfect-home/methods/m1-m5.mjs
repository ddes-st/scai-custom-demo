/**
 * Deterministic methods M1–M5.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import {
  readSectionHtml,
  readSectionInfo,
  readPageHtml,
  rewriteCaptureAssetUrls,
  wrapHtmlDocument,
  writeMethodArtifacts,
  escapeForJsString,
  ensureDir,
  methodTargetDir,
  exists,
} from '../lib/io.mjs';
import { withStabilize, withCaptureCss } from '../lib/preview-tweaks.mjs';
import { capturePageDir, SAMPLE_SECTIONS } from '../lib/paths.mjs';

function sectionTsxWrapper(componentName, html) {
  return `import React from 'react';

export type ${componentName}Props = Record<string, never>;

/** Auto-generated experiment component — HTML capture wrapper */
export default function ${componentName}(_props: ${componentName}Props) {
  return (
    <div
      data-bq-experiment="html-wrapper"
      dangerouslySetInnerHTML={{ __html: \`${escapeForJsString(html)}\` }}
    />
  );
}
`;
}

function pascalFromSection(sectionFolder, suffix = '') {
  const n = sectionFolder.replace('section-', '');
  return `Section${n}${suffix}`;
}

/** M1 — serve capture HTML as-is (oracle) */
export async function runM1(sections = SAMPLE_SECTIONS) {
  for (const section of sections) {
    const raw = await readSectionHtml(section);
    const rewritten = rewriteCaptureAssetUrls(raw, {
      fromDir: path.join(capturePageDir, 'sections', section),
    });
    const preview = wrapHtmlDocument(rewritten, {
      title: `M1 ${section}`,
      extraHead: withCaptureCss(),
    });
    await writeMethodArtifacts('M01', section, {
      tsx: sectionTsxWrapper(pascalFromSection(section, 'Oracle'), rewritten),
      previewHtml: preview,
      meta: { method: 'M1', description: 'HTML oracle — capture section.html' },
    });
  }
  // Full page oracle
  const pageRaw = await readPageHtml();
  const pageRewritten = rewriteCaptureAssetUrls(pageRaw, {
    fromDir: path.join(capturePageDir, 'html'),
  });
  const pagePreview = wrapHtmlDocument(pageRewritten, {
    title: 'M1 full page',
    extraHead: withStabilize(),
  });
  // page.html is already a full document — use rewritten file directly if it has html tag
  const fullPreview = /<html[\s>]/i.test(pageRewritten)
    ? pageRewritten.replace(/<head([^>]*)>/i, `<head$1>${withStabilize()}`)
    : pagePreview;
  await writeMethodArtifacts('M01', 'full-page', {
    tsx: sectionTsxWrapper('FullPageOracle', '<!-- see preview.html -->'),
    previewHtml: fullPreview,
    meta: { method: 'M1', description: 'Full page.html oracle' },
  });
}

/** M2 — React dangerouslySetInnerHTML wrapper (same pixels as M1 if assets resolve) */
export async function runM2(sections = SAMPLE_SECTIONS) {
  for (const section of sections) {
    const raw = await readSectionHtml(section);
    const rewritten = rewriteCaptureAssetUrls(raw, {
      fromDir: path.join(capturePageDir, 'sections', section),
    });
    const name = pascalFromSection(section, 'Wrapper');
    const preview = wrapHtmlDocument(rewritten, {
      title: `M2 ${section}`,
      extraHead: withCaptureCss(),
    });
    await writeMethodArtifacts('M02', section, {
      tsx: sectionTsxWrapper(name, rewritten),
      previewHtml: preview,
      meta: { method: 'M2', description: 'TSX dangerouslySetInnerHTML + capture CSS' },
    });
  }
}

/**
 * M3 — Playwright computed-style flatten → inline-styled HTML + TSX
 */
export async function runM3(sections = SAMPLE_SECTIONS) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const section of sections) {
      const raw = await readSectionHtml(section);
      const rewritten = rewriteCaptureAssetUrls(raw, {
        fromDir: path.join(capturePageDir, 'sections', section),
      });
      const previewIn = wrapHtmlDocument(rewritten, {
        title: `M3 source ${section}`,
        extraHead: withStabilize(),
      });
      const tmpDir = await ensureDir(methodTargetDir('M03', section));
      const tmpHtml = path.join(tmpDir, '_source.html');
      await writeFile(tmpHtml, previewIn, 'utf8');

      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(300);

      const flattened = await page.evaluate(() => {
        const PROP_LIST = [
          'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
          'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
          'margin', 'padding', 'box-sizing',
          'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'gap',
          'grid-template-columns', 'grid-template-rows', 'grid-gap',
          'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
          'text-align', 'text-decoration', 'text-transform', 'white-space', 'color',
          'background', 'background-color', 'background-image', 'background-size', 'background-position',
          'border', 'border-radius', 'box-shadow', 'opacity', 'overflow', 'overflow-x', 'overflow-y',
          'transform', 'filter', 'object-fit', 'vertical-align',
        ];
        function serialize(el) {
          if (el.nodeType === Node.TEXT_NODE) {
            const t = el.textContent || '';
            return t.trim() ? t.replace(/</g, '&lt;') : '';
          }
          if (el.nodeType !== Node.ELEMENT_NODE) return '';
          const tag = el.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'link', 'meta'].includes(tag)) {
            if (tag === 'style') return el.outerHTML;
            return '';
          }
          const cs = window.getComputedStyle(el);
          const styles = [];
          for (const p of PROP_LIST) {
            const v = cs.getPropertyValue(p);
            if (!v || v === 'none' || v === 'normal' || v === 'auto' || v === 'static' || v === 'rgba(0, 0, 0, 0)') continue;
            if (p === 'width' && v === '0px') continue;
            styles.push(`${p}:${v}`);
          }
          const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';
          if (['img', 'br', 'hr', 'input', 'svg'].includes(tag) && tag !== 'svg') {
            if (tag === 'img') {
              const src = el.getAttribute('src') || '';
              const alt = el.getAttribute('alt') || '';
              return `<img src="${src}" alt="${alt}"${styleAttr}/>`;
            }
            return `<${tag}${styleAttr}/>`;
          }
          let inner = '';
          for (const child of el.childNodes) inner += serialize(child);
          if (tag === 'svg') return el.outerHTML;
          return `<${tag}${styleAttr}>${inner}</${tag}>`;
        }
        const root = document.body.firstElementChild || document.body;
        return serialize(root);
      });

      await context.close();

      const preview = wrapHtmlDocument(flattened, {
        title: `M3 ${section}`,
        extraHead: withStabilize(),
      });
      const name = pascalFromSection(section, 'Computed');
      await writeMethodArtifacts('M03', section, {
        tsx: sectionTsxWrapper(name, flattened),
        previewHtml: preview,
        meta: { method: 'M3', description: 'Computed-style flatten via Playwright' },
      });
    }
  } finally {
    await browser.close();
  }
}

/**
 * M4 — Keep markup + extract/inline <style> blocks + linked capture CSS subset via data URL of page-inline + section styles
 */
export async function runM4(sections = SAMPLE_SECTIONS) {
  for (const section of sections) {
    const raw = await readSectionHtml(section);
    const rewritten = rewriteCaptureAssetUrls(raw, {
      fromDir: path.join(capturePageDir, 'sections', section),
    });
    // Prefer already self-contained section.html styles; also pull page-inline.css if present
    let extraCss = '';
    const inlinePath = path.join(capturePageDir, 'css', 'page-inline.css');
    if (await exists(inlinePath)) {
      const { readFile } = await import('node:fs/promises');
      const css = await readFile(inlinePath, 'utf8');
      // Keep only CSS variables / short root rules to avoid huge payloads
      const rootBlocks = css.match(/:root\s*\{[^}]+\}/g) || [];
      extraCss = rootBlocks.slice(0, 5).join('\n');
    }
    const preview = wrapHtmlDocument(rewritten, {
      title: `M4 ${section}`,
      extraHead: withCaptureCss(`<style id="bq-root-vars">${extraCss}</style>`),
    });
    const name = pascalFromSection(section, 'CssModule');
    const tsx = `import React from 'react';
import './${section}.module.css';

export default function ${name}() {
  return (
    <div className="${section}-root" dangerouslySetInnerHTML={{ __html: \`${escapeForJsString(raw)}\` }} />
  );
}
`;
    const dir = await writeMethodArtifacts('M04', section, {
      tsx,
      previewHtml: preview,
      meta: { method: 'M4', description: 'Class-preserving HTML + CSS module stub + root vars' },
    });
    await writeFile(
      path.join(dir, `${section}.module.css`),
      `/* Placeholder module — styles live in capture section.html <style> blocks */\n.${section}-root { display: contents; }\n`,
      'utf8'
    );
  }
}

/**
 * M5 — Token + pattern template from section-information.json (no pixel cloning)
 */
export async function runM5(sections = SAMPLE_SECTIONS) {
  let tokens = { colors: [], fonts: [] };
  try {
    const { readFile } = await import('node:fs/promises');
    const detectedCss = JSON.parse(
      await readFile(path.join(capturePageDir, 'detected-css.json'), 'utf8')
    );
    tokens.colors = (detectedCss.colors || detectedCss.palette || []).slice(0, 12);
    tokens.fonts = (detectedCss.fonts || []).slice(0, 6);
  } catch {
    tokens = {
      colors: ['#000000', '#ffffff', '#6E3FFF', '#F5F5F5'],
      fonts: ['Inter', 'system-ui'],
    };
  }

  for (const section of sections) {
    const info = await readSectionInfo(section);
    const fields = info.suggestedFields || [];
    const title =
      fields.find((f) => /headline|title/i.test(f.name))?.value ||
      info.heading ||
      section;
    const lead = fields.find((f) => /lead|description|body/i.test(f.name))?.value || info.purpose || '';
    const actions = fields.find((f) => f.type === 'array')?.value || [];
    const accent = tokens.colors[2] || '#6E3FFF';
    const font = (tokens.fonts[0] && (tokens.fonts[0].family || tokens.fonts[0])) || 'system-ui';

    const buttons = (Array.isArray(actions) ? actions : [])
      .map(
        (a, i) =>
          `<a href="${a.link || '#'}" style="display:inline-flex;align-items:center;padding:0.75rem 1.25rem;border-radius:999px;font-weight:600;text-decoration:none;${
            i === 0
              ? `background:${accent};color:#fff;`
              : `background:transparent;color:#111;border:1px solid #111;`
          }">${a.label || 'Action'}</a>`
      )
      .join('\n');

    const body = `
<section style="font-family:${font},system-ui,sans-serif;padding:3rem 1.5rem;text-align:center;background:#fff;color:#111;">
  <h1 style="font-size:clamp(2rem,5vw,3.5rem);line-height:1.05;font-weight:600;max-width:52rem;margin:0 auto 1.25rem;">${String(title).replace(/</g, '&lt;')}</h1>
  <p style="font-size:1.05rem;line-height:1.55;max-width:40rem;margin:0 auto 1.5rem;color:#333;">${String(lead).replace(/</g, '&lt;')}</p>
  <div style="display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center;">${buttons}</div>
</section>`;

    const name = pascalFromSection(section, 'TokenTemplate');
    const tsx = `import React from 'react';

export default function ${name}() {
  return (
    <section className="flex flex-col items-center px-6 py-12 text-center" style={{ fontFamily: '${font}, system-ui' }}>
      <h1 className="mb-5 max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">${String(title).replace(/`/g, '')}</h1>
      <p className="mb-6 max-w-xl text-base leading-relaxed text-neutral-700">${String(lead).replace(/`/g, '')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        ${(Array.isArray(actions) ? actions : [])
          .map(
            (a, i) =>
              `<a key="${i}" href="${a.link || '#'}" className="${
                i === 0 ? 'rounded-full bg-violet-600 px-5 py-3 font-semibold text-white' : 'rounded-full border border-black px-5 py-3 font-semibold'
              }">${a.label || 'Action'}</a>`
          )
          .join('\n        ')}
      </div>
    </section>
  );
}
`;
    await writeMethodArtifacts('M05', section, {
      tsx,
      previewHtml: wrapHtmlDocument(body, { title: `M5 ${section}`, extraHead: withStabilize() }),
      meta: {
        method: 'M5',
        description: 'Token + pattern template from section-information.json',
        tokensUsed: tokens,
      },
    });
  }
}

export async function runDeterministicAll(sections = SAMPLE_SECTIONS) {
  console.log('M1…');
  await runM1(sections);
  console.log('M2…');
  await runM2(sections);
  console.log('M3…');
  await runM3(sections);
  console.log('M4…');
  await runM4(sections);
  console.log('M5…');
  await runM5(sections);
}
