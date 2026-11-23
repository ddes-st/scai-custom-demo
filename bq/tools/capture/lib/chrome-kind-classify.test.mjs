/**
 * Run: node --test tools/capture/lib/chrome-kind-classify.test.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTopStacks,
  classifyChromeBands,
  dropNestedHeaderStackSections,
  isChromeExportTrack,
  isFloatOverlaySection,
  isForcedFloatOverlay,
  stackClearsContent,
  stampChromeKindOnSections,
} from './chrome-kind-classify.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('buildTopStacks', () => {
  it('stacks adjacent top bands by cumulative height', () => {
    const stacks = buildTopStacks([
      { id: 'a', top: 0, bottom: 34, height: 34 },
      { id: 'b', top: 34, bottom: 98, height: 64 },
      { id: 'c', top: 200, bottom: 240, height: 40 },
    ]);
    assert.equal(stacks.length, 1);
    assert.deepEqual(
      stacks[0].map((b) => b.id),
      ['a', 'b'],
    );
  });
});

describe('stackClearsContent', () => {
  it('matches mainTop or bodyPad to stack height', () => {
    assert.equal(stackClearsContent(98, { mainTop: 98 }), true);
    assert.equal(stackClearsContent(98, { mainTop: 0, bodyPadTop: 98 }), true);
    assert.equal(stackClearsContent(98, { mainTop: 0, bodyPadTop: 0 }), false);
    assert.equal(stackClearsContent(98, { mainTop: 0, occupancyReserved: true }), true);
  });
});

describe('isForcedFloatOverlay', () => {
  it('flags cookie type and bottom/center floats without cmsName brand gates', () => {
    assert.equal(
      isForcedFloatOverlay(
        { id: 'c', top: 612, bottom: 884, height: 272, type: 'cookie-banner' },
        { mainTop: 98, viewportHeight: 900 },
      ),
      true,
    );
    assert.equal(
      isForcedFloatOverlay(
        { id: 'd', top: 500, bottom: 800, height: 300, roleDialog: true },
        { mainTop: 98, viewportHeight: 900 },
      ),
      true,
    );
    assert.equal(
      isForcedFloatOverlay(
        { id: 'a', top: 0, bottom: 34, height: 34, type: 'topbar' },
        { mainTop: 98, viewportHeight: 900 },
      ),
      false,
    );
  });
});

describe('classifyChromeBands', () => {
  it('marks stacked top clearance bands as header; cookie as overlay', () => {
    const result = classifyChromeBands(
      [
        { id: 'ann', top: 0, bottom: 34, height: 34, type: 'topbar' },
        { id: 'nav', top: 34, bottom: 98, height: 64, type: 'header' },
        {
          id: 'cmp',
          top: 612,
          bottom: 884,
          height: 272,
          type: 'cookie-banner',
          roleDialog: true,
        },
      ],
      { mainTop: 98, bodyPadTop: 0, viewportHeight: 900 },
    );
    assert.equal(result.get('ann').track, 'header');
    assert.equal(result.get('ann').isOverlay, false);
    assert.equal(result.get('ann').chromeKind, 'header-stack');
    assert.equal(result.get('nav').track, 'header');
    assert.equal(result.get('nav').isOverlay, false);
    assert.equal(result.get('cmp').track, 'overlay');
    assert.equal(result.get('cmp').isOverlay, true);
    assert.equal(result.get('cmp').chromeKind, 'float-overlay');
  });

  it('marks top float without clearance as overlay', () => {
    const result = classifyChromeBands(
      [{ id: 'float', top: 0, bottom: 48, height: 48, type: 'banner' }],
      { mainTop: 0, bodyPadTop: 0, viewportHeight: 900 },
    );
    assert.equal(result.get('float').track, 'overlay');
    assert.equal(result.get('float').isOverlay, true);
  });

  it('marks single sticky header with clearance as header', () => {
    const result = classifyChromeBands(
      [{ id: 'nav', top: 0, bottom: 72, height: 72, type: 'navigation' }],
      { mainTop: 72, viewportHeight: 900 },
    );
    assert.equal(result.get('nav').track, 'header');
    assert.equal(result.get('nav').isOverlay, false);
  });
});

describe('stampChromeKindOnSections', () => {
  it('stamps track/header and isOverlay false without relying on AnnouncementBar names', () => {
    const sections = [
      {
        cmsName: 'BandA',
        type: 'topbar',
        selector: '.a',
        cssTop: 0,
        cssBottom: 34,
        cssHeight: 34,
      },
      {
        cmsName: 'BandB',
        type: 'header',
        selector: '.b',
        cssTop: 34,
        cssBottom: 98,
        cssHeight: 64,
      },
      {
        cmsName: 'BandC',
        type: 'cookie-banner',
        selector: '.c',
        cssTop: 600,
        cssBottom: 880,
        cssHeight: 280,
      },
    ];
    stampChromeKindOnSections(sections, {
      mainTop: 98,
      viewportHeight: 900,
    });
    assert.equal(sections[0].track, 'header');
    assert.equal(sections[0].isOverlay, false);
    assert.equal(sections[1].track, 'header');
    assert.equal(sections[1].isOverlay, false);
    assert.equal(sections[2].track, 'overlay');
    assert.equal(sections[2].isOverlay, true);
  });
});

describe('export helpers', () => {
  it('treats header as chrome export but not float overlay', () => {
    const header = { track: 'header', isOverlay: false, chromeKind: 'header-stack' };
    const overlay = { track: 'overlay', isOverlay: true, chromeKind: 'float-overlay' };
    assert.equal(isChromeExportTrack(header), true);
    assert.equal(isFloatOverlaySection(header), false);
    assert.equal(isChromeExportTrack(overlay), true);
    assert.equal(isFloatOverlaySection(overlay), true);
  });
});

describe('dropNestedHeaderStackSections', () => {
  it('drops nested Drupal-like inner header-stack contained in outer Header', () => {
    const sections = [
      {
        cmsName: 'Header',
        chromeKind: 'header-stack',
        track: 'header',
        selector: 'header.region.region--header',
        cssTop: 0,
        cssBottom: 69,
        cssLeft: 0,
        cssRight: 1024,
        cssHeight: 69,
      },
      {
        cmsName: 'LangSelector',
        chromeKind: 'header-stack',
        track: 'header',
        selector: 'div.region-header-inner',
        cssTop: 0,
        cssBottom: 61,
        cssLeft: 0,
        cssRight: 1024,
        cssHeight: 61,
      },
    ];
    const out = dropNestedHeaderStackSections(sections);
    assert.equal(out.length, 1);
    assert.equal(out[0].cmsName, 'Header');
  });

  it('keeps sibling announcement + header stacks that are not contained', () => {
    const sections = [
      {
        cmsName: 'TopBar',
        chromeKind: 'header-stack',
        track: 'header',
        selector: '.announcement',
        cssTop: 0,
        cssBottom: 40,
        cssLeft: 0,
        cssRight: 1024,
        cssHeight: 40,
      },
      {
        cmsName: 'Header',
        chromeKind: 'header-stack',
        track: 'header',
        selector: 'header',
        cssTop: 40,
        cssBottom: 110,
        cssLeft: 0,
        cssRight: 1024,
        cssHeight: 70,
      },
    ];
    const out = dropNestedHeaderStackSections(sections);
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((s) => s.cmsName),
      ['TopBar', 'Header'],
    );
  });

  it('drops inner via DOM contains matrix even when rects barely overlap', () => {
    const sections = [
      {
        cmsName: 'Header',
        chromeKind: 'header-stack',
        track: 'header',
        selector: 'header',
        cssTop: 0,
        cssBottom: 80,
        cssLeft: 0,
        cssRight: 1000,
        cssHeight: 80,
      },
      {
        cmsName: 'Navigation',
        chromeKind: 'header-stack',
        track: 'header',
        selector: 'nav.inner',
        // Mis-measured strip that would not pass rect containment alone.
        cssTop: 100,
        cssBottom: 140,
        cssLeft: 0,
        cssRight: 1000,
        cssHeight: 40,
      },
    ];
    // sections[0] contains sections[1] in the live DOM.
    const domContains = [
      [false, true],
      [false, false],
    ];
    const out = dropNestedHeaderStackSections(sections, { domContains });
    assert.equal(out.length, 1);
    assert.equal(out[0].cmsName, 'Header');
  });
});

describe('sticky-overlays nest-drop source contract', () => {
  it('nest-drops TopBar, LangSelector, and Navigation inside Header', () => {
    const src = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'sticky-overlays.mjs'),
      'utf8',
    );
    assert.match(src, /nestDropNames\s*=\s*new Set\(\[\s*'TopBar',\s*'LangSelector',\s*'Navigation'\s*\]\)/);
    // Layout `region` must not score as locale via class/id alone.
    assert.match(src, /langWordClsId/);
    assert.match(src, /langWordText/);
    assert.doesNotMatch(
      src,
      /langWordClsId\s*=\s*\/\\b\([^/]*région\|region/,
    );
  });
});
