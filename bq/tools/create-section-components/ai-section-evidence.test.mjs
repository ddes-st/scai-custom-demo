/**
 * section.html AI evidence loader/formatter tests.
 * Run: node --test tools/create-section-components/ai-section-evidence.test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, after } from 'node:test';
import {
  loadSectionHtmlForAiEvidence,
  loadSectionAiEvidence,
  loadPreferredSectionHtml,
  formatSectionAiHtmlAndCss,
  formatInteractionContractForPrompt,
  deriveExclusivePeerSelectionFromEvidence,
  listInteractiveStates,
  buildSectionEvidenceParts,
  buildSectionEvidenceMessage,
  AI_SECTION_HTML_MAX_CHARS,
} from './ai-codegen.mjs';

/** 1×1 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('loadSectionHtmlForAiEvidence', () => {
  /** @type {string[]} */
  const temps = [];

  after(async () => {
    for (const dir of temps) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  async function setupSection(files) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-ev-'));
    temps.push(root);
    const sectionDir = path.join(root, 'sections', 'section-01');
    await mkdir(sectionDir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      await writeFile(path.join(sectionDir, name), body, 'utf8');
    }
    return root;
  }

  it('returns section.html when present (not original or authored.css)', async () => {
    const pageDir = await setupSection({
      'original-section.html': '<div class="raw">original</div>',
      'section.authored.css': '.raw { color: red; }',
      'section.html':
        '<html><head><style>.feat{color:blue}</style></head><body><div class="feat">card</div></body></html>',
    });
    const result = await loadSectionHtmlForAiEvidence(pageDir, 'section-01', {});
    assert.equal(result.label, 'section.html');
    assert.match(result.html, /feat\{color:blue\}/);
    assert.match(result.html, /class="feat"/);
    assert.doesNotMatch(result.html, /class="raw"/);
  });

  it('falls back to original-section.html when styled section.html is missing (html mode)', async () => {
    const pageDir = await setupSection({
      'original-section.html': '<div class="raw">original only</div>',
      'section.authored.css': '.raw { color: red; }',
    });
    const result = await loadSectionHtmlForAiEvidence(pageDir, 'section-01', {
      sectionHtml: 'sections/section-01/original-section.html',
    });
    assert.equal(result.label, 'original-section.html');
    assert.match(result.html, /original only/);
  });

  it('prefers original-section.html in png evidence mode', async () => {
    const pageDir = await setupSection({
      'original-section.html': '<div class="raw">original</div>',
      'section.html':
        '<html><head><style>.feat{}</style></head><body><div class="feat">styled</div></body></html>',
    });
    const result = await loadSectionHtmlForAiEvidence(
      pageDir,
      'section-01',
      {},
      { evidenceMode: 'png' },
    );
    assert.equal(result.label, 'original-section.html');
    assert.match(result.html, /class="raw"/);
  });

  it('falls back to legacy styled-desktop when section.html missing', async () => {
    const pageDir = await setupSection({
      'section.styled-desktop.html': '<div class="legacy">styled</div>',
      'original-section.html': '<div class="raw">original</div>',
    });
    const result = await loadSectionHtmlForAiEvidence(pageDir, 'section-01', {});
    assert.equal(result.label, 'section.styled-desktop.html');
    assert.match(result.html, /legacy/);
  });
});

describe('loadSectionAiEvidence', () => {
  /** @type {string[]} */
  const temps = [];

  after(async () => {
    for (const dir of temps) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('packs section.html without authored css fields', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-ev2-'));
    temps.push(root);
    const sectionDir = path.join(root, 'sections', 'section-02');
    await mkdir(sectionDir, { recursive: true });
    await writeFile(
      path.join(sectionDir, 'section.html'),
      '<style>.a{}</style><div>hi</div>',
      'utf8',
    );
    await writeFile(path.join(sectionDir, 'section.authored.css'), '.ignored{}', 'utf8');
    await writeFile(path.join(sectionDir, 'original-section.html'), '<div>orig</div>', 'utf8');

    const evidence = await loadSectionAiEvidence(root, 'section-02', {});
    assert.equal(evidence.htmlLabel, 'section.html');
    assert.match(evidence.html, /\.a\{\}/);
    assert.equal('css' in evidence, false);
    assert.equal('cssSource' in evidence, false);
  });
});

describe('loadPreferredSectionHtml (wiring)', () => {
  /** @type {string[]} */
  const temps = [];

  after(async () => {
    for (const dir of temps) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('still prefers original-section.html for structural wiring', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-ev3-'));
    temps.push(root);
    const sectionDir = path.join(root, 'sections', 'section-03');
    await mkdir(sectionDir, { recursive: true });
    await writeFile(path.join(sectionDir, 'original-section.html'), '<div>orig</div>', 'utf8');
    await writeFile(path.join(sectionDir, 'section.html'), '<div>styled</div>', 'utf8');

    const preferred = await loadPreferredSectionHtml(root, 'section-03', {});
    assert.equal(preferred.label, 'original-section.html');
    assert.match(preferred.html, /orig/);
  });
});

describe('formatSectionAiHtmlAndCss', () => {
  it('labels section.html and omits scoped authored CSS pack', () => {
    const text = formatSectionAiHtmlAndCss({
      html: '<style>.x{}</style><div class="x">y</div>',
      htmlLabel: 'section.html',
    });
    assert.match(text, /SECTION EVIDENCE \(section\.html/);
    assert.match(text, /PRIMARY \(structure \+ content wiring \+ visual CSS\)/);
    assert.match(text, /Screenshots are not attached in html evidence mode/);
    assert.match(text, /Do NOT copy capture class lists into TSX/);
    assert.doesNotMatch(text, /Match Tailwind to this document/);
    assert.match(text, /\.x\{\}/);
    assert.doesNotMatch(text, /SCOPED AUTHORED CSS/);
    assert.doesNotMatch(text, /original-section\.html/);
  });

  it('labels original-section.html for png evidence framing', () => {
    const text = formatSectionAiHtmlAndCss({
      html: '<div class="raw">orig</div>',
      htmlLabel: 'original-section.html',
    });
    assert.match(text, /raw DOM structure, no inlined CSS/);
    assert.match(text, /screenshots lead/i);
    assert.match(text, /class="raw"/);
  });

  it('truncates only when htmlMax is set', () => {
    const html = 'a'.repeat(AI_SECTION_HTML_MAX_CHARS + 50);
    const text = formatSectionAiHtmlAndCss(
      { html, htmlLabel: 'section.html' },
      { htmlMax: 100 },
    );
    assert.match(text, /\[truncated \d+ chars\]/);
    assert.ok(text.includes('a'.repeat(100)));
    assert.ok(!text.includes('a'.repeat(101)));
  });

  it('sends full HTML by default (no truncate)', () => {
    const html = 'a'.repeat(AI_SECTION_HTML_MAX_CHARS + 50);
    const text = formatSectionAiHtmlAndCss({ html, htmlLabel: 'section.html' });
    assert.doesNotMatch(text, /\[truncated/);
    assert.ok(text.includes(html));
  });

  it('does not warn on large full HTML (cost noise removed)', () => {
    const html = 'a'.repeat(120_000);
    const warns = [];
    const orig = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      formatSectionAiHtmlAndCss({ html, htmlLabel: 'section.html' });
    } finally {
      console.warn = orig;
    }
    assert.equal(
      warns.filter((w) => /higher token cost|full HTML sent/i.test(w)).length,
      0,
    );
  });

  it('explicit missing message when empty', () => {
    const text = formatSectionAiHtmlAndCss({ html: '', htmlLabel: 'section.html' });
    assert.match(text, /section\.html missing/);
    assert.doesNotMatch(text, /SCOPED AUTHORED CSS/);
  });
});

describe('buildSectionEvidenceParts', () => {
  /** @type {string[]} */
  const temps = [];

  after(async () => {
    for (const dir of temps) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('attaches resting crops and leftover states/ PNGs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-parts-'));
    temps.push(root);
    const sectionDir = path.join(root, 'sections', 'section-03');
    const statesDir = path.join(sectionDir, 'states', 'menu-open');
    await mkdir(statesDir, { recursive: true });
    await writeFile(path.join(sectionDir, 'section-03-desktop.png'), TINY_PNG);
    await writeFile(path.join(statesDir, 'menu-open-desktop.png'), TINY_PNG);
    await writeFile(path.join(statesDir, 'extra-orphan.png'), TINY_PNG);

    const { parts, attachments } = await buildSectionEvidenceParts(
      root,
      'section-03',
      {
        outputs: {
          desktop: { path: 'sections/section-03/section-03-desktop.png', method: 'section-html' },
        },
        interactionStates: [
          {
            kind: 'menu',
            slug: 'menu-open',
            depth: 1,
            label: 'Open',
            outputs: {
              desktop: {
                path: 'sections/section-03/states/menu-open/menu-open-desktop.png',
              },
            },
          },
        ],
      },
      { attachScreenshots: true },
    );

    const texts = parts.filter((p) => p.type === 'text').map((p) => p.text);
    assert.ok(texts.some((t) => /Screenshot \(desktop\)/.test(t)));
    assert.ok(texts.some((t) => /State screenshot menu-open/.test(t)));
    assert.ok(texts.some((t) => /Additional state screenshot/.test(t) && /extra-orphan/.test(t)));
    assert.ok(parts.filter((p) => p.type === 'image_url' || p.image_url || p.type === 'image').length >= 2 || parts.length >= 6);
    assert.ok(attachments.includes('sections/section-03/section-03-desktop.png'));
    assert.ok(
      attachments.some((a) => /menu-open-desktop\.png$/.test(a)),
    );
  });

  it('default env attaches only mobile/tablet/desktop even when five outputs exist', async () => {
    const prev = process.env.BQ_SCREENSHOT_VIEWPORTS;
    delete process.env.BQ_SCREENSHOT_VIEWPORTS;
    try {
      const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-parts3-'));
      temps.push(root);
      const sectionDir = path.join(root, 'sections', 'section-10');
      await mkdir(sectionDir, { recursive: true });
      const keys = [
        ['desktop', 'desktop'],
        ['desktopRegular', 'desktop-regular'],
        ['desktopLarge', 'desktop-large'],
        ['tablet', 'tablet'],
        ['mobile', 'mobile'],
      ];
      /** @type {Record<string, { path: string }>} */
      const outputs = {};
      for (const [key, slug] of keys) {
        const file = `section-10-${slug}.png`;
        await writeFile(path.join(sectionDir, file), TINY_PNG);
        outputs[key] = { path: `sections/section-10/${file}` };
      }

      const { parts } = await buildSectionEvidenceParts(
        root,
        'section-10',
        { outputs },
        { attachScreenshots: true },
      );
      const shotOrder = parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .filter((t) => /^Screenshot \(/.test(t))
        .map((t) => t.match(/^Screenshot \(([^)]+)\)/)?.[1]);
      assert.deepEqual(shotOrder, ['desktop', 'tablet', 'mobile']);
    } finally {
      if (prev === undefined) delete process.env.BQ_SCREENSHOT_VIEWPORTS;
      else process.env.BQ_SCREENSHOT_VIEWPORTS = prev;
    }
  });

  it('attaches all five Sitecore AI resting crops when env lists all keys', async () => {
    const prev = process.env.BQ_SCREENSHOT_VIEWPORTS;
    process.env.BQ_SCREENSHOT_VIEWPORTS =
      'mobile,tablet,desktop,desktopRegular,desktopLarge';
    try {
      const root = await mkdtemp(path.join(os.tmpdir(), 'bq-ai-parts5-'));
      temps.push(root);
      const sectionDir = path.join(root, 'sections', 'section-10');
      await mkdir(sectionDir, { recursive: true });
      const keys = [
        ['desktop', 'desktop'],
        ['desktopRegular', 'desktop-regular'],
        ['desktopLarge', 'desktop-large'],
        ['tablet', 'tablet'],
        ['mobile', 'mobile'],
      ];
      /** @type {Record<string, { path: string }>} */
      const outputs = {};
      for (const [key, slug] of keys) {
        const file = `section-10-${slug}.png`;
        await writeFile(path.join(sectionDir, file), TINY_PNG);
        outputs[key] = { path: `sections/section-10/${file}` };
      }

      const { parts } = await buildSectionEvidenceParts(
        root,
        'section-10',
        { outputs },
        { attachScreenshots: true },
      );
      const texts = parts.filter((p) => p.type === 'text').map((p) => p.text);
      for (const [key] of keys) {
        assert.ok(
          texts.some((t) => t.startsWith(`Screenshot (${key})`)),
          `missing Screenshot (${key})`,
        );
      }
      const shotOrder = texts
        .filter((t) => /^Screenshot \(/.test(t))
        .map((t) => t.match(/^Screenshot \(([^)]+)\)/)?.[1]);
      assert.deepEqual(shotOrder, [
        'desktop',
        'desktopRegular',
        'desktopLarge',
        'tablet',
        'mobile',
      ]);
    } finally {
      if (prev === undefined) delete process.env.BQ_SCREENSHOT_VIEWPORTS;
      else process.env.BQ_SCREENSHOT_VIEWPORTS = prev;
    }
  });
});

describe('formatInteractionContractForPrompt', () => {
  it('returns empty when no notes and no usable states', () => {
    assert.equal(formatInteractionContractForPrompt({}), '');
    assert.equal(
      formatInteractionContractForPrompt({
        interactionStates: [{ kind: 'hover', slug: 'x' }],
      }),
      '',
    );
  });

  it('emits HARD contract for menu-open shaped info', () => {
    const info = {
      layout: {
        interactionNotes:
          'The header includes an expandable product menu and language dropdown.',
      },
      interactionStates: [
        {
          slug: 'menu-open',
          kind: 'menu',
          label: 'Menu',
          narrowOnly: true,
          trigger: { selector: '#mobile-menu-anchor', method: 'click' },
          panel: { selector: '#mobile-menu' },
          outputs: {
            mobile: { path: 'states/menu-open/mobile.png' },
            tablet: { path: 'states/menu-open/tablet.png' },
            desktop: { path: null },
          },
        },
      ],
    };
    assert.equal(listInteractiveStates(info).length, 1);
    const out = formatInteractionContractForPrompt(info);
    assert.match(out, /INTERACTION CONTRACT \(HARD/);
    assert.match(out, /expandable product menu/);
    assert.match(out, /kind=menu slug=menu-open/);
    assert.match(out, /#mobile-menu-anchor/);
    assert.match(out, /#mobile-menu/);
    assert.match(out, /narrowOnly=true/);
    assert.match(out, /clientTsx REQUIRED/);
    assert.match(out, /shots=mobile,tablet/);
  });

  it('includes contract in buildSectionEvidenceMessage framing', () => {
    const info = {
      layout: { interactionNotes: 'Tabs switch panels.' },
      interactionStates: [
        {
          kind: 'tab',
          slug: 'tab-b',
          trigger: { selector: '.tab-b', method: 'click' },
          panel: { selector: '#panel-b' },
        },
      ],
    };
    const msg = buildSectionEvidenceMessage({
      aiEvidence: { html: '<div/>' },
      evidenceParts: [],
      attachScreenshots: false,
      info,
    });
    const text = Array.isArray(msg.content)
      ? msg.content.find((p) => p.type === 'text')?.text
      : '';
    assert.match(String(text), /INTERACTION CONTRACT/);
    assert.match(String(text), /kind=tab/);
  });

  it('derives exclusive peer selection from section-10-shaped notes + tab states', () => {
    const info = {
      layout: {
        interactionNotes:
          'Selecting a customer tab changes the active story, logo treatment, title state, and video thumbnail. The active video can open a modal player. Mobile panels behave as an accordion and only the selected story is expanded.',
      },
      interactionStates: [
        {
          kind: 'tab',
          slug: 'tab-shriners',
          label: 'Shriners Children’s modernized care through DX',
          trigger: { selector: '.tab-2', method: 'click' },
          panel: { selector: '#panel-1' },
        },
        {
          kind: 'tab',
          slug: 'tab-goto',
          label: 'How GoTo Technologies modernized its digital experience',
          trigger: { selector: '.tab-3', method: 'click' },
          panel: { selector: '#panel-2' },
        },
        {
          kind: 'tab',
          slug: 'tab-afl',
          label: "The backbone of AFL's martech stack",
          trigger: { selector: '.tab-4', method: 'click' },
          panel: { selector: '#panel-3' },
        },
      ],
    };
    const derived = deriveExclusivePeerSelectionFromEvidence(info);
    assert.ok(derived.length >= 2, derived.join('\n'));
    assert.match(derived.join('\n'), /exclusive/i);
    assert.match(derived.join('\n'), /only one peer is active/i);
    assert.match(derived.join('\n'), /Do not show all peer media/);
    assert.doesNotMatch(derived.join('\n'), /Children\.toArray|data-media-tab|Story Titles/);

    const out = formatInteractionContractForPrompt(info);
    assert.match(out, /BEHAVIOR FROM EVIDENCE/);
    assert.match(out, /only the selected story is expanded/);
    assert.match(out, /exclusive alternatives/);
    assert.doesNotMatch(out, /Children\.toArray|never a parent Multi-Line/);
  });

  it('does not invent exclusive selection for menu-only evidence', () => {
    const derived = deriveExclusivePeerSelectionFromEvidence({
      layout: {
        interactionNotes: 'The header includes an expandable product menu.',
      },
      interactionStates: [
        {
          kind: 'menu',
          slug: 'menu-open',
          label: 'Menu',
          trigger: { selector: '#menu', method: 'click' },
          panel: { selector: '#panel' },
        },
      ],
    });
    assert.deepEqual(derived, []);
  });
});
